import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const defaultAlternatives = [
  {
    name: "Formule moins chère",
    price: 5.99,
    gainAnnual: 60,
    reason: "Moins chère pour un usage occasionnel.",
    difficulty: "facile",
    steps: [
      "Ouvre les paramètres de ton abonnement.",
      "Choisis une formule plus économique.",
      "Confirme la modification.",
    ],
  },
];

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
  const userId = userData.user.id;

  const payload = await request.json();
  const { plan_item_id, answers } = payload as {
    plan_item_id: string;
    answers: { frequency: string; people: string; usage?: string };
  };

  if (!plan_item_id || !answers?.frequency || !answers?.people) {
    return NextResponse.json({ error: "Missing plan_item_id or answers" }, { status: 400 });
  }

  const { data: planItem, error: itemError } = await supabaseAdmin
    .from("plan_items")
    .select("*")
    .eq("id", plan_item_id)
    .eq("user_id", userId)
    .single();

  if (itemError || !planItem) {
    return NextResponse.json({ error: "Plan item not found" }, { status: 404 });
  }

  const context = (planItem.usage_context as Record<string, unknown>) ?? {};
  const subscription = (context.subscription as string) ?? planItem.action_title ?? "Abonnement";
  const price = typeof context.monthly_price_eur === "number" ? context.monthly_price_eur : null;

  const prompt = `Tu es un expert en optimisation d’abonnements en France 2026.
Abonnement actuel : ${subscription}${price ? ` – ${price} €/mois` : ""}
Réponses utilisateur :
Fréquence : ${answers.frequency}
Nombre de personnes/appareils : ${answers.people}
Usage principal : ${answers.usage ?? "Non précisé"}

Propose 2–3 alternatives plus adaptées ou moins chères.
Pour chaque alternative :
Nom exact
Prix actuel France
Gain annuel vs actuel
Pourquoi c’est mieux
Difficulté (très facile / facile / moyenne)
3 étapes concrètes pour changer

Réponds uniquement en JSON :
{
  "alternatives": [
    {
      "name": "...",
      "price": 8.99,
      "gainAnnual": 108,
      "reason": "...",
      "difficulty": "très facile",
      "steps": ["1. ...", "2. ...", "3. ..."]
    }
  ]
}`;

  let alternatives = defaultAlternatives;

  if (OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 450,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Tu réponds uniquement en JSON valide." },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content) as { alternatives?: typeof alternatives };
          if (Array.isArray(parsed.alternatives) && parsed.alternatives.length > 0) {
            alternatives = parsed.alternatives;
          }
        }
      }
    } catch {
      // fallback handled
    }
  }

  const best = alternatives[0];
  const updatedFields: Record<string, unknown> = {
    usage_answers: answers,
    usage_alternatives: alternatives,
    usage_refined: true,
  };

  if (best?.steps?.length) {
    updatedFields.action_steps = best.steps.map((step: string) => step.replace(/^\d+\.\s*/, ""));
  }

  if (typeof best?.gainAnnual === "number") {
    updatedFields.gain_estimated_yearly_cents = Math.round(best.gainAnnual * 100);
  }

  if (best?.name) {
    updatedFields.action_title = `Alternative : ${best.name}`;
  }

  const { data: updatedItem, error: updateError } = await supabaseAdmin
    .from("plan_items")
    .update(updatedFields)
    .eq("id", plan_item_id)
    .select("*")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ item: updatedItem });
}
