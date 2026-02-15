import { NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    status: "particulier" | "professionnel";
    currentCost: number;
    bestOffer: { name: string; yearly: number };
    savings: number;
  };

  const systemPrompt = `Tu es un assistant énergie très pratique et rassurant pour OptiCash.
Contexte utilisateur :
Statut : ${payload.status}
Offre actuelle : coût ${payload.currentCost} € / an
Meilleure offre : ${payload.bestOffer.name}, ${payload.bestOffer.yearly} € / an, économie ${payload.savings} € / an

Génère un bloc texte “Comment changer facilement d’offre” personnalisé :
Si particulier : explique que c’est gratuit, sans coupure, nouveau fournisseur s’occupe de tout, préavis max 1 mois.
Si professionnel : insiste sur vérification échéance/engagement/préavis, recommande courtier si pertinent (Selectra Pro, HelloWatt Pro, Opéra Énergie avec site/tél).
Mets en avant les gains : “Tu peux gagner ${payload.savings} € / an dès maintenant !”
Liste numérotée claire des étapes (3–5 étapes max)
Ton positif, simple, motivant

Réponds uniquement avec le texte du bloc (pas de JSON, pas d’intro).`;

  if (!OPENAI_API_KEY) {
    return NextResponse.json({
      text:
        "1. Compare ton offre actuelle avec une nouvelle offre adaptée.\n" +
        `2. Tu peux gagner ${payload.savings} € / an dès maintenant !\n` +
        "3. Choisis une offre et valide : le changement est pris en charge.\n" +
        "4. Préavis max 1 mois pour particulier, vérifie ton contrat si pro.",
    });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 220,
      messages: [{ role: "system", content: systemPrompt }],
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "OpenAI error" }, { status: 500 });
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "Étapes indisponibles.";
  return NextResponse.json({ text });
}
