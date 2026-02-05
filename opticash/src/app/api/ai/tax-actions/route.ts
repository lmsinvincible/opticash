import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const buildDefaultActions = (input: {
  salaryMonthly?: number;
  kmAnnual?: number;
  donations?: number;
  children?: number;
}) => {
  const actions: Array<{
    title: string;
    gainEstime: number;
    preuve: string;
    raisonnement: string[];
    etapes: string[];
    score: number;
  }> = [];

  if (input.salaryMonthly && input.salaryMonthly > 0) {
    const annual = input.salaryMonthly * 12;
    const gain = clamp(Math.round(annual * 0.015), 400, 1800);
    actions.push({
      title: "Ajuster ton taux PAS",
      gainEstime: gain,
      preuve: `Salaire mensuel moyen déclaré : ${input.salaryMonthly} €`,
      raisonnement: [
        "Ton taux de prélèvement peut être ajusté en fonction de ton revenu actuel.",
        "Un ajustement évite une régularisation importante.",
        "Tu gagnes du cash-flow dès maintenant.",
      ],
      etapes: [
        "Va sur impots.gouv.fr → FranceConnect.",
        "Clique sur “Gérer mon prélèvement à la source”.",
        "Choisis “Actualiser suite à une hausse/baisse de revenus”.",
        "Renseigne tes revenus et valide.",
      ],
      score: 90,
    });
  }

  if (input.donations && input.donations > 0) {
    const gain = clamp(Math.round(input.donations * 0.66), 60, 800);
    actions.push({
      title: "Déclarer tes dons non pris en compte",
      gainEstime: gain,
      preuve: `Dons détectés/estimés : ${input.donations} €`,
      raisonnement: [
        "Les dons aux associations ouvrent droit à une réduction d’impôt.",
        "Le taux est souvent de 66 %.",
        "Tu peux récupérer une partie importante de tes dons.",
      ],
      etapes: [
        "Va sur impots.gouv.fr → Déclarer mes revenus.",
        "Cherche la rubrique “Dons aux associations”.",
        "Renseigne le montant total des dons.",
        "Valide ta déclaration.",
      ],
      score: 85,
    });
  }

  if (input.kmAnnual && input.kmAnnual > 0) {
    const gain = clamp(Math.round(input.kmAnnual * 0.63), 500, 2500);
    actions.push({
      title: "Déclarer tes frais kilométriques",
      gainEstime: gain,
      preuve: `Km domicile-travail estimés : ${input.kmAnnual} km/an`,
      raisonnement: [
        "Les frais kilométriques peuvent remplacer la déduction forfaitaire.",
        "Le barème 2026 valorise fortement les kilomètres déclarés.",
        "Cela peut réduire ton impôt de manière significative.",
      ],
      etapes: [
        "Va sur impots.gouv.fr → Déclarer mes revenus.",
        "Choisis “Frais réels” plutôt que forfait.",
        "Calcule tes km domicile-travail et applique le barème.",
        "Renseigne le montant total et valide.",
      ],
      score: 92,
    });
  }

  return actions;
};

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
  const { salary, km, children, donations, notes } = payload as {
    salary: number;
    km: number;
    children: number;
    donations: number;
    notes?: string;
  };

  const { data: scan } = await supabaseAdmin
    .from("scans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const summary = (scan.summary as Record<string, unknown>) ?? {};
  const taxContext =
    typeof summary.tax_context === "object" && summary.tax_context
      ? (summary.tax_context as Record<string, unknown>)
      : {};
  const donationsDetected = Number(taxContext.donations_detected_eur ?? 0);

  const input = {
    salaryMonthly: Number(salary) || 0,
    kmAnnual: Number(km) || 0,
    donations: Number(donations) || donationsDetected || 0,
    children: Number(children) || 0,
  };

  let actions = buildDefaultActions(input);

  if (OPENAI_API_KEY) {
    const prompt = `Tu es un expert fiscal français 2026 ultra-pratique et rassurant.
Données :
Salaire mensuel moyen : ${input.salaryMonthly} €
Km domicile-travail déclarés : ${input.kmAnnual} km/an
Dons détectés : ${input.donations} €
Enfants à charge : ${input.children}
Autres infos utilisateur : ${notes ?? ""}

Pour chaque opportunité impôts :
Détecte si applicable
Calcule gain net estimé (barèmes 2026)
Donne preuve (ex. : ligne CSV ou réponse utilisateur)
Explique en 3 lignes simples pourquoi c’est une économie
Donne 4–5 étapes concrètes (clics exacts sur impots.gouv.fr)

Réponds UNIQUEMENT en JSON :
{
  "impotsActions": [
    {
      "title": "Ajuster ton taux PAS",
      "gainEstime": 1200,
      "preuve": "Salaire moyen 2800 € vs taux 12 %",
      "raisonnement": ["Ligne 1 : ...", "Étape 2 : ..."],
      "etapes": ["1. impots.gouv.fr → FranceConnect", "2. ...", "3. ...", "4. ..."],
      "score": 96
    }
  ]
}`;

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
          max_tokens: 700,
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
          const parsed = JSON.parse(content) as { impotsActions?: typeof actions };
          if (Array.isArray(parsed.impotsActions) && parsed.impotsActions.length > 0) {
            actions = parsed.impotsActions;
          }
        }
      }
    } catch {
      // fallback
    }
  }

  const planItems = actions.map((action, index) => ({
    user_id: userId,
    plan_id: plan.id,
    finding_id: null,
    position: 100 + index,
    category: "tax",
    action_title: action.title,
    action_steps: action.etapes ?? [],
    gain_estimated_yearly_cents: Math.round((action.gainEstime ?? 0) * 100),
    effort_minutes: 15,
    risk_level: "low",
    priority_score: action.score ?? 80,
    proof: action.preuve ?? "",
    reasoning: action.raisonnement ?? [],
    status: "todo",
  }));

  if (planItems.length > 0) {
    await supabaseAdmin.from("plan_items").insert(planItems);
    await supabaseAdmin
      .from("plans")
      .update({
        total_gain_estimated_yearly_cents:
          Number(plan.total_gain_estimated_yearly_cents ?? 0) +
          planItems.reduce((acc, item) => acc + Number(item.gain_estimated_yearly_cents || 0), 0),
      })
      .eq("id", plan.id);
  }

  await supabaseAdmin
    .from("scans")
    .update({
      tax_answers: {
        salary: input.salaryMonthly,
        km: input.kmAnnual,
        children: input.children,
        donations: input.donations,
        notes: notes ?? "",
      },
      tax_generated: true,
    })
    .eq("id", scan.id);

  return NextResponse.json({ items: planItems });
}
