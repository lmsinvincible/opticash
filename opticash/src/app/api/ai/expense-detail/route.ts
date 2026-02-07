import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const { item, history, avgAmount } = payload as {
    item: {
      date: string;
      label: string;
      amount: number;
      categorie: string;
      lieu?: string;
      type?: string;
      opportunite?: string;
    };
    history: { date: string; amount: number }[];
    avgAmount: number;
  };

  if (!item?.label) {
    return NextResponse.json({ error: "Missing item" }, { status: 400 });
  }

  const prompt = `Tu es un expert en analyse de dépenses personnelles.
Ligne : ${item.date} | ${item.label} | ${item.amount} €
Catégorie : ${item.categorie}
Lieu/merchant : ${item.lieu ?? "inconnu"}
Type : ${item.type ?? "non précisé"}
Opportunité : ${item.opportunite ?? "—"}
Historique (12 max): ${JSON.stringify(history)}
Moyenne historique : ${avgAmount}

Donne :
- une analyse concise (2-3 phrases)
- 2-3 suggestions concrètes
- 2-3 prochaines étapes
Réponds en JSON strict:
{ "analysis": "...", "suggestions": ["..."], "next_steps": ["..."] }`;

  if (!OPENAI_API_KEY) {
    return NextResponse.json({
      analysis:
        "Analyse approfondie indisponible sans clé IA. Ajoute OPENAI_API_KEY pour activer.",
      suggestions: [],
      next_steps: [],
    });
  }

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
        max_tokens: 260,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Tu réponds uniquement en JSON valide." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "OpenAI error" }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "No content" }, { status: 500 });
    }
    const parsed = JSON.parse(content) as {
      analysis: string;
      suggestions: string[];
      next_steps: string[];
    };
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
