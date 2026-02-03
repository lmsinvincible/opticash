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
  return {
    category: "subscriptions",
    title: `Abonnement détecté : ${label}`,
    description: "Transactions récurrentes détectées.",
    gainCents: gain,
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

  rows.slice(1).forEach((row) => {
    const dateValue = row[dateIndex] ?? "";
    const labelValue = row[labelIndex] ?? "";
    const amountValue = row[amountIndex] ?? "";
    const date = parseDate(dateValue);
    const amountCents = parseAmount(amountValue);
    if (!date || amountCents === null) return;
    if (amountCents >= 0) return;
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
      summary: { source: "csv", total_gain_estimated_yearly_cents: totalGain },
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

  const planItems = findings
    .sort((a, b) => b.gainCents * b.confidence - a.gainCents * a.confidence)
    .slice(0, 6)
    .map((finding, index) => ({
      user_id: userId,
      plan_id: planRow.id,
      finding_id: findingMap.get(finding.title) ?? null,
      position: index + 1,
      action_title: finding.title,
      action_steps: [
        "Vérifier les transactions",
        "Comparer avec le marché",
        "Mettre en place l'action",
      ],
      gain_estimated_yearly_cents: finding.gainCents,
      effort_minutes: finding.effortMinutes,
      risk_level: finding.riskLevel,
      priority_score: Math.round((finding.gainCents * finding.confidence) / 100) / 10,
      status: "todo",
    }));

  const { error: planItemsError } = await supabaseAdmin.from("plan_items").insert(planItems);
  if (planItemsError) {
    return NextResponse.json({ error: planItemsError.message }, { status: 500 });
  }

  await supabaseAdmin.from("uploads").update({ status: "parsed" }).eq("id", upload_id);

  return NextResponse.json({ scan_id: scanRow.id, plan_id: planRow.id });
}
