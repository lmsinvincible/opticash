import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Mapping = {
  date: string;
  label: string;
  amount: string;
};

type Transaction = {
  date: Date;
  label: string;
  normalizedLabel: string;
  amountCents: number;
};

type FindingSeed = {
  category: "subscriptions" | "bank_fees";
  title: string;
  description: string;
  gainCents: number;
  monthlyPriceCents?: number;
  subscriptionName?: string | null;
  effortMinutes: number;
  riskLevel: "low" | "medium" | "high";
  confidence: number;
  explain: {
    calc_steps: string[];
    assumptions: string[];
    recommendation: string;
  };
  evidence: Array<{
    occurred_at: string;
    amount_cents: number;
    merchant: string;
    raw_label: string;
  }>;
};

const MAX_ROWS = 5000;
const MAX_FINDINGS = 8;
const MAX_EVIDENCE = 12;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SUBSCRIPTION_MATCHERS = [
  { name: "Netflix", match: /netflix/ },
  { name: "Spotify", match: /spotify/ },
  { name: "Deezer", match: /deezer/ },
  { name: "Disney+", match: /disney/ },
  { name: "Apple Music", match: /apple music/ },
  { name: "YouTube Premium", match: /youtube/ },
  { name: "Canva", match: /canva/ },
  { name: "LinkedIn Premium", match: /linkedin/ },
  { name: "Amazon Prime", match: /prime/ },
];

const DONATION_MATCHERS = [
  /don/i,
  /donation/i,
  /unicef/i,
  /croix rouge/i,
  /msf/i,
  /medecins sans frontieres/i,
  /restos? du coeur/i,
  /secours populaire/i,
  /secours catholique/i,
  /telethon/i,
];

const defaultSteps = (title: string) => [
  "Vérifie les transactions concernées.",
  `Connecte-toi au service lié à “${title}”.`,
  "Applique l’action recommandée.",
  "Confirme la modification.",
];

const normalizeLabel = (label: string) => {
  return label
    .toLowerCase()
    .replace(/\d+/g, "#")
    .replace(/\b(cb|carte|sepa|virement|paiement|prelevement)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
};

const parseAmount = (value: string) => {
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100);
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

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const stableAmount = (values: number[]) => {
  if (values.length < 2) return false;
  const avg = values.reduce((acc, value) => acc + value, 0) / values.length;
  const maxDiff = Math.max(...values.map((value) => Math.abs(value - avg)));
  return maxDiff <= 200 || maxDiff / avg <= 0.2;
};

const recurringMonthly = (dates: Date[]) => {
  if (dates.length < 3) return false;
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const intervals = sorted.slice(1).map((date, index) => {
    const diff = date.getTime() - sorted[index].getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  });
  const med = median(intervals);
  return med >= 20 && med <= 40;
};

const buildSubscriptionFinding = (label: string, entries: Transaction[]): FindingSeed => {
  const amounts = entries.map((entry) => Math.abs(entry.amountCents));
  const avg = Math.round(amounts.reduce((acc, value) => acc + value, 0) / amounts.length);
  const gain = avg * 12;
  const subscription = SUBSCRIPTION_MATCHERS.find((item) => item.match.test(label))?.name ?? null;
  return {
    category: "subscriptions",
    title: `Abonnement détecté : ${label}`,
    description: "Transactions récurrentes détectées.",
    gainCents: gain,
    monthlyPriceCents: avg,
    subscriptionName: subscription,
    effortMinutes: 5,
    riskLevel: "low",
    confidence: 0.9,
    explain: {
      calc_steps: [`Moyenne ${avg / 100}€/mois × 12 = ${gain / 100}€/an`],
      assumptions: ["Récurrence mensuelle détectée sur 3+ occurrences"],
      recommendation: "Vérifie si cet abonnement est utile, sinon résilie.",
    },
    evidence: entries.slice(0, MAX_EVIDENCE).map((entry) => ({
      occurred_at: entry.date.toISOString().slice(0, 10),
      amount_cents: Math.abs(entry.amountCents),
      merchant: entry.label,
      raw_label: entry.label,
    })),
  };
};

const buildBankFeeFinding = (label: string, entries: Transaction[]): FindingSeed => {
  const amounts = entries.map((entry) => Math.abs(entry.amountCents));
  const avg = Math.round(amounts.reduce((acc, value) => acc + value, 0) / amounts.length);
  const gain = avg * 12;
  return {
    category: "bank_fees",
    title: `Frais bancaires : ${label}`,
    description: "Frais bancaires récurrents détectés.",
    gainCents: gain,
    effortMinutes: 10,
    riskLevel: "low",
    confidence: 0.85,
    explain: {
      calc_steps: [`Moyenne ${avg / 100}€/mois × 12 = ${gain / 100}€/an`],
      assumptions: ["Récurrence mensuelle détectée sur 3+ occurrences"],
      recommendation: "Changer d'offre ou de banque peut réduire ces frais.",
    },
    evidence: entries.slice(0, MAX_EVIDENCE).map((entry) => ({
      occurred_at: entry.date.toISOString().slice(0, 10),
      amount_cents: Math.abs(entry.amountCents),
      merchant: entry.label,
      raw_label: entry.label,
    })),
  };
};

const generateStepsWithAI = async ({
  title,
  description,
  gainCents,
  effortMinutes,
}: {
  title: string;
  description: string;
  gainCents: number;
  effortMinutes: number;
}) => {
  if (!OPENAI_API_KEY) {
    return defaultSteps(title);
  }

  const prompt = `Tu es un expert en optimisation financière pratique et tu parles un français très clair et direct.

Pour l’action suivante :
Titre : ${title}
Description : ${description}
Gain estimé : ${(gainCents / 100).toFixed(0)} €/an
Effort estimé : ${effortMinutes} minutes

Génère 4 à 6 étapes actionnables très concrètes, numérotées, que n’importe qui peut suivre en moins de 10 minutes.
Utilise un ton rassurant, simple, sans jargon.
Ajoute 1 astuce ou conseil bonus si pertinent.
Inclue si possible un lien direct utile (URL réelle si tu la connais).

Réponds uniquement au format JSON suivant :
{
  "steps": ["1. ...", "2. ...", "..."],
  "tips": "Une astuce ou conseil bonus",
  "links": ["url1", "url2"]
}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 350,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Tu réponds uniquement en JSON valide." },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return defaultSteps(title);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return defaultSteps(title);

    const parsed = JSON.parse(content) as {
      steps?: string[];
      tips?: string;
      links?: string[];
    };
    const steps = Array.isArray(parsed.steps) ? parsed.steps.filter(Boolean) : [];
    if (!steps.length) return defaultSteps(title);

    const normalized = steps.map((step) =>
      step.replace(/^\d+\.\s*/, "").trim()
    );

    if (parsed.tips) {
      normalized.push(`Astuce : ${parsed.tips}`);
    }
    if (Array.isArray(parsed.links) && parsed.links.length > 0) {
      normalized.push(`Lien utile : ${parsed.links[0]}`);
    }

    return normalized.slice(0, 6);
  } catch {
    return defaultSteps(title);
  } finally {
    clearTimeout(timeout);
  }
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
  const { upload_id, mapping } = payload as { upload_id: string; mapping: Mapping };

  if (!upload_id || !mapping?.date || !mapping?.label || !mapping?.amount) {
    return NextResponse.json({ error: "Missing upload_id or mapping" }, { status: 400 });
  }

  const { data: uploadRow, error: uploadError } = await supabaseAdmin
    .from("uploads")
    .select("*")
    .eq("id", upload_id)
    .eq("user_id", userId)
    .single();

  if (uploadError || !uploadRow) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_premium, is_admin")
    .eq("id", userId)
    .maybeSingle();

  const isPremium = Boolean(profile?.is_premium);
  const isAdmin = Boolean(profile?.is_admin);
  if (!isPremium && !isAdmin) {
    const { count } = await supabaseAdmin
      .from("scans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) >= 1) {
      return NextResponse.json({ error: "Free scan limit reached" }, { status: 402 });
    }
  }

  const { data: fileData, error: downloadError } = await supabaseAdmin.storage
    .from("uploads")
    .download(uploadRow.storage_path);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: downloadError?.message ?? "Download failed" }, { status: 500 });
  }

  const csvText = await fileData.text();
  const parsed = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
    preview: MAX_ROWS,
  });

  if (parsed.errors.length) {
    return NextResponse.json({ error: parsed.errors[0].message }, { status: 400 });
  }

  const rows = parsed.data as string[][];
  const header = uploadRow.columns as string[];
  const columnIndex = (col: string) => header.indexOf(col);
  const dateIndex = columnIndex(mapping.date);
  const labelIndex = columnIndex(mapping.label);
  const amountIndex = columnIndex(mapping.amount);

  if (dateIndex === -1 || labelIndex === -1 || amountIndex === -1) {
    return NextResponse.json({ error: "Invalid mapping columns" }, { status: 400 });
  }

  const transactions: Transaction[] = [];
  let donationsCents = 0;

  rows.slice(1).forEach((row) => {
    const dateValue = row[dateIndex] ?? "";
    const labelValue = row[labelIndex] ?? "";
    const amountValue = row[amountIndex] ?? "";
    const date = parseDate(dateValue);
    const amountCents = parseAmount(amountValue);
    if (!date || amountCents === null) return;
    if (amountCents >= 0) return;
    if (DONATION_MATCHERS.some((regex) => regex.test(labelValue))) {
      donationsCents += Math.abs(amountCents);
    }
    transactions.push({
      date,
      label: labelValue,
      normalizedLabel: normalizeLabel(labelValue),
      amountCents,
    });
  });

  const grouped = new Map<string, Transaction[]>();
  transactions.forEach((tx) => {
    const key = tx.normalizedLabel || tx.label;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(tx);
  });

  const subscriptionFindings: FindingSeed[] = [];
  const bankFeeFindings: FindingSeed[] = [];
  const keywordRegex = /(frais|cotisation|tenue|commission|agios|package|carte|incident)/i;

  grouped.forEach((entries, key) => {
    if (entries.length < 3) return;
    const dates = entries.map((entry) => entry.date);
    const amounts = entries.map((entry) => Math.abs(entry.amountCents));
    if (!recurringMonthly(dates) || !stableAmount(amounts)) return;
    if (keywordRegex.test(key)) {
      bankFeeFindings.push(buildBankFeeFinding(key, entries));
    } else {
      subscriptionFindings.push(buildSubscriptionFinding(key, entries));
    }
  });

  const findings = [...subscriptionFindings, ...bankFeeFindings]
    .sort((a, b) => b.gainCents - a.gainCents)
    .slice(0, MAX_FINDINGS);

  if (findings.length === 0) {
    return NextResponse.json({ error: "No findings detected" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const totalGain = findings.reduce((acc, finding) => acc + finding.gainCents, 0);

  const { data: scanRow, error: scanError } = await supabaseAdmin
    .from("scans")
    .insert({
      user_id: userId,
      status: "done",
      started_at: now,
      finished_at: now,
      summary: {
        source: "csv",
        total_gain_estimated_yearly_cents: totalGain,
        tax_context: {
          donations_detected_eur: Math.round((donationsCents / 100) * 100) / 100,
        },
      },
    })
    .select("*")
    .single();

  if (scanError || !scanRow) {
    return NextResponse.json({ error: scanError?.message ?? "Failed to create scan" }, { status: 500 });
  }

  const { data: findingRows, error: findingError } = await supabaseAdmin
    .from("findings")
    .insert(
      findings.map((finding) => ({
        user_id: userId,
        scan_id: scanRow.id,
        category: finding.category,
        title: finding.title,
        description: finding.description,
        status: "open",
        confidence: finding.confidence,
        gain_estimated_yearly_cents: finding.gainCents,
        effort_minutes: finding.effortMinutes,
        risk_level: finding.riskLevel,
        explain: finding.explain,
      }))
    )
    .select("*");

  if (findingError || !findingRows) {
    return NextResponse.json({ error: findingError?.message ?? "Failed to create findings" }, { status: 500 });
  }

  const findingMap = new Map<string, string>();
  findingRows.forEach((row) => {
    const match = findings.find((finding) => finding.title === row.title);
    if (match) {
      findingMap.set(match.title, row.id);
    }
  });

  const evidenceRows = findings.flatMap((finding) => {
    const findingId = findingMap.get(finding.title);
    if (!findingId) return [];
    return finding.evidence.slice(0, MAX_EVIDENCE).map((row) => ({
      user_id: userId,
      finding_id: findingId,
      source: "csv_row",
      occurred_at: row.occurred_at,
      amount_cents: row.amount_cents,
      currency: "EUR",
      merchant: row.merchant,
      raw_label: row.raw_label,
      reference: `${findingId}-${row.occurred_at}`,
      payload: row,
    }));
  });

  const { error: evidenceError } = await supabaseAdmin.from("evidence").insert(evidenceRows);
  if (evidenceError) {
    return NextResponse.json({ error: evidenceError.message }, { status: 500 });
  }

  const { data: planRow, error: planError } = await supabaseAdmin
    .from("plans")
    .insert({
      user_id: userId,
      scan_id: scanRow.id,
      title: "Ton plan OptiCash",
      total_gain_estimated_yearly_cents: totalGain,
    })
    .select("*")
    .single();

  if (planError || !planRow) {
    return NextResponse.json({ error: planError?.message ?? "Failed to create plan" }, { status: 500 });
  }

  const topFindings = findings
    .sort((a, b) => b.gainCents * b.confidence - a.gainCents * a.confidence)
    .slice(0, 6);

  const stepsByTitle = new Map<string, string[]>();
  for (const finding of topFindings) {
    const steps = await generateStepsWithAI({
      title: finding.title,
      description: finding.description,
      gainCents: finding.gainCents,
      effortMinutes: finding.effortMinutes,
    });
    stepsByTitle.set(finding.title, steps);
  }

  const planItems = topFindings.map((finding, index) => ({
    user_id: userId,
    plan_id: planRow.id,
    finding_id: findingMap.get(finding.title) ?? null,
    position: index + 1,
    action_title: finding.title,
    action_steps: stepsByTitle.get(finding.title) ?? defaultSteps(finding.title),
    gain_estimated_yearly_cents: finding.gainCents,
    effort_minutes: finding.effortMinutes,
    risk_level: finding.riskLevel,
    priority_score: Math.round((finding.gainCents * finding.confidence) / 100) / 10,
    has_usage_questions: Boolean(finding.subscriptionName),
    usage_context: finding.subscriptionName
      ? {
          subscription: finding.subscriptionName,
          monthly_price_eur: finding.monthlyPriceCents
            ? Math.round((finding.monthlyPriceCents / 100) * 100) / 100
            : null,
          currency: "EUR",
        }
      : {},
    status: "todo",
  }));

  const { error: planItemsError } = await supabaseAdmin.from("plan_items").insert(planItems);
  if (planItemsError) {
    return NextResponse.json({ error: planItemsError.message }, { status: 500 });
  }

  await supabaseAdmin.from("uploads").update({ status: "parsed" }).eq("id", upload_id);

  return NextResponse.json({ scan_id: scanRow.id, plan_id: planRow.id });
}
