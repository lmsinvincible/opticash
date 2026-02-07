import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

  const payload = await request.json();
  const { messages, summary } = payload as {
    messages: { role: "user" | "assistant"; content: string }[];
    summary: Record<string, unknown>;
  };

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }

  const systemPrompt = `Tu es un assistant financier pour OptiCash.
Tu réponds de manière simple, claire et concrète.
Contexte de l'utilisateur (résumé des dépenses filtrées) : ${JSON.stringify(summary)}
Réponds en français, en 2-5 phrases.`;

  if (!OPENAI_API_KEY) {
    return NextResponse.json({
      reply:
        "Je peux résumer tes dépenses si l’IA est activée. Ajoute la clé OPENAI_API_KEY pour activer ce résumé.",
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
        max_tokens: 220,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "OpenAI error" }, { status: 500 });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? "Je n’ai pas pu répondre.";
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
