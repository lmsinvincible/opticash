import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Mapping = {
  date: string;
  label: string;
  amount: string;
};

type ExpenseLine = {
  line: number;
  date: string;
  label: string;
  amount: number;
};

type AiDetail = {
  line: number;
  categorie: string;
  lieu: string;
  type: string;
  opportunite: string;
};

const MAX_LINES = 100;
const BATCH_SIZE = 20;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const parseAmount = (value: string) => {
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100) / 100;
};

const parseDate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
    const [day, month, year] = trimmed.split("/").map((part) => Number(part));
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const analyzeBatch = async (lines: ExpenseLine[]): Promise<AiDetail[]> => {
  if (!OPENAI_API_KEY) {
    return lines.map((line) => ({
      line: line.line,
      categorie: "Non classé",
      lieu: "—",
      type: "Dépense",
      opportunite: "—",
    }));
  }

  const promptLines = lines
    .map(
      (line) =>
        `Ligne ${line.line}: Date ${line.date}, Libellé "${line.label}", Montant ${line.amount} €`
    )
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert en catégorisation de dépenses françaises 2026. Réponds uniquement en JSON valide.",
        },
        {
          role: "user",
          content: `Pour chaque ligne ci-dessous, donne catégorie détaillée, lieu inféré, type de dépense, opportunité d'économie.\nRéponds en JSON : { "items": [ { "line": 1, "categorie": "...", "lieu": "...", "type": "...", "opportunite": "..." } ] }\n\n${promptLines}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return lines.map((line) => ({
      line: line.line,
      categorie: "Non classé",
      lieu: "—",
      type: "Dépense",
      opportunite: "—",
    }));
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(content) as { items?: AiDetail[] };
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return lines.map((line) => ({
      line: line.line,
      categorie: "Non classé",
      lieu: "—",
      type: "Dépense",
      opportunite: "—",
    }));
  }
};

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const userId = authData.user.id;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_premium, is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.is_premium && !profile?.is_admin) {
    return NextResponse.json({ error: "Premium required" }, { status: 402 });
  }

  const { data: scanRow } = await supabaseAdmin
    .from("scans")
    .select("summary, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const summary = (scanRow?.summary ?? {}) as {
    upload_id?: string;
    mapping?: Mapping;
  };

  if (!summary.upload_id || !summary.mapping) {
    return NextResponse.json({ error: "No CSV mapping found. Relance un scan CSV." }, { status: 400 });
  }

  const { data: uploadRow } = await supabaseAdmin
    .from("uploads")
    .select("*")
    .eq("id", summary.upload_id)
    .eq("user_id", userId)
    .single();

  if (!uploadRow?.storage_path) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  const { data: fileData, error: downloadError } = await supabaseAdmin.storage
    .from("uploads")
    .download(uploadRow.storage_path);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }

  const csvText = await fileData.text();
  const parsed = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
    preview: MAX_LINES + 1,
  });

  if (parsed.errors.length) {
    return NextResponse.json({ error: parsed.errors[0].message }, { status: 400 });
  }

  const rows = parsed.data as string[][];
  const header = uploadRow.columns as string[];
  const columnIndex = (col: string) => header.indexOf(col);
  const dateIndex = columnIndex(summary.mapping.date);
  const labelIndex = columnIndex(summary.mapping.label);
  const amountIndex = columnIndex(summary.mapping.amount);

  if (dateIndex === -1 || labelIndex === -1 || amountIndex === -1) {
    return NextResponse.json({ error: "Invalid mapping columns" }, { status: 400 });
  }

  const lines: ExpenseLine[] = [];
  rows.slice(1).forEach((row, index) => {
    if (lines.length >= MAX_LINES) return;
    const dateValue = row[dateIndex] ?? "";
    const labelValue = row[labelIndex] ?? "";
    const amountValue = row[amountIndex] ?? "";
    const date = parseDate(dateValue);
    const amount = parseAmount(amountValue);
    if (!date || amount === null) return;
    lines.push({
      line: index + 2,
      date: date.toISOString().slice(0, 10),
      label: labelValue,
      amount,
    });
  });

  if (!lines.length) {
    return NextResponse.json({ error: "No lines detected" }, { status: 400 });
  }

  const detailed: AiDetail[] = [];
  for (let i = 0; i < lines.length; i += BATCH_SIZE) {
    const batch = lines.slice(i, i + BATCH_SIZE);
    const details = await analyzeBatch(batch);
    detailed.push(...details);
  }

  const detailMap = new Map<number, AiDetail>();
  detailed.forEach((detail) => detailMap.set(detail.line, detail));

  const result = lines.map((line) => {
    const detail = detailMap.get(line.line);
    return {
      ...line,
      categorie: detail?.categorie ?? "Non classé",
      lieu: detail?.lieu ?? "—",
      type: detail?.type ?? "Dépense",
      opportunite: detail?.opportunite ?? "—",
    };
  });

  return NextResponse.json({
    count: result.length,
    items: result,
  });
}
