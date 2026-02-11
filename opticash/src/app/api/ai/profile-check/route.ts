import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userData.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const profile = (await request.json()) as Record<string, unknown>;

  if (!OPENAI_API_KEY) {
    return NextResponse.json({
      note:
        "Ajoute la clé OPENAI_API_KEY pour activer l’analyse IA du profil. Pour l’instant, vérifie que le code postal, le revenu mensuel et les km domicile-travail sont bien renseignés.",
    });
  }

  const systemPrompt = `Tu es un conseiller fiscal français 2026.
Tu dois vérifier si le profil utilisateur est suffisamment complet pour optimiser ses impôts.
Réponds en français, en 3 à 6 phrases courtes, avec des conseils actionnables.
Si des champs importants sont manquants (revenu, km, enfants, situation), indique-les clairement.`;

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
        max_tokens: 220,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Profil utilisateur: ${JSON.stringify(profile)}` },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "OpenAI error" }, { status: 500 });
    }

    const data = await response.json();
    const note = data.choices?.[0]?.message?.content ?? "Analyse indisponible.";
    return NextResponse.json({ note });
  } catch {
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
