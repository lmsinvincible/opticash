import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

type ExpensesSummary = {
  count: number;
  totalSpent: number;
  netTotal: number;
  topCategories: { name: string; total: number }[];
  topMerchants: { name: string; total: number }[];
  query?: string;
  category?: string;
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

  const payload = (await request.json()) as { summary?: ExpensesSummary };
  if (!payload.summary) {
    return NextResponse.json({ error: "Missing summary" }, { status: 400 });
  }

  if (!OPENAI_API_KEY) {
    return NextResponse.json({
      headline: "Résumé indisponible",
      summary:
        "Ajoute une clé OPENAI_API_KEY pour obtenir un résumé intelligent des dépenses.",
      highlights: [],
      alerts: [],
      global_advice: "Aucune recommandation disponible sans IA.",
    });
  }

  const systemPrompt = `Tu es un conseiller financier pour OptiCash.
Tu rédiges un résumé clair et utile des dépenses.
Tu dois :
- donner une synthèse en 4-6 phrases,
- donner 3 à 5 points clés concrets,
- donner 2 à 4 alertes ou conseils pratiques,
- conclure par un avis global (1 phrase).
Réponds en français, sans jargon.`;

  const userPrompt = `Résumé structuré des dépenses : ${JSON.stringify(payload.summary)}.
Retourne uniquement du JSON conforme au schéma :
{
  "headline": "Titre court",
  "summary": "Synthèse en 4-6 phrases",
  "highlights": ["Point 1", "Point 2", "Point 3"],
  "alerts": ["Alerte 1", "Alerte 2"],
  "global_advice": "Avis global en 1 phrase"
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
        max_tokens: 420,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "OpenAI error" }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
