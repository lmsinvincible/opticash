import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type DemoFindingSeed = {
  key: string;
  category: "bank_fees" | "subscriptions" | "insurance" | "tax" | "utilities" | "other";
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

const demoFindings: DemoFindingSeed[] = [
  {
    key: "subscriptions",
    category: "subscriptions",
    title: "Abonnements oubliés (2)",
    description: "Deux abonnements détectés sans usage récent.",
    gainCents: 24000,
    effortMinutes: 5,
    riskLevel: "low",
    confidence: 0.9,
    explain: {
      calc_steps: ["12€ + 8€ par mois", "20€ × 12 mois = 240€/an"],
      assumptions: ["Aucun usage détecté sur 60 jours"],
      recommendation: "Annuler les services non utilisés.",
    },
    evidence: [
      { occurred_at: "2025-12-05", amount_cents: 1200, merchant: "StreamPlus", raw_label: "STREAMPLUS" },
      { occurred_at: "2025-11-05", amount_cents: 1200, merchant: "StreamPlus", raw_label: "STREAMPLUS" },
      { occurred_at: "2025-10-05", amount_cents: 1200, merchant: "StreamPlus", raw_label: "STREAMPLUS" },
      { occurred_at: "2025-12-12", amount_cents: 800, merchant: "MusiqueNow", raw_label: "MUSIQUENOW" },
      { occurred_at: "2025-11-12", amount_cents: 800, merchant: "MusiqueNow", raw_label: "MUSIQUENOW" },
      { occurred_at: "2025-10-12", amount_cents: 800, merchant: "MusiqueNow", raw_label: "MUSIQUENOW" },
    ],
  },
  {
    key: "bank_fees",
    category: "bank_fees",
    title: "Frais de tenue de compte",
    description: "8€ prélevés chaque mois.",
    gainCents: 9600,
    effortMinutes: 10,
    riskLevel: "low",
    confidence: 0.88,
    explain: {
      calc_steps: ["8€ × 12 mois = 96€/an"],
      assumptions: ["Frais constants sur 12 mois"],
      recommendation: "Passer à une offre sans frais.",
    },
    evidence: Array.from({ length: 6 }).map((_, index) => ({
      occurred_at: `2025-${String(12 - index).padStart(2, "0")}-10`,
      amount_cents: 800,
      merchant: "Banque XYZ",
      raw_label: "FRAIS TENUE COMPTE",
    })),
  },
  {
    key: "insurance",
    category: "insurance",
    title: "Assurance auto surcotée",
    description: "Prime supérieure au benchmark marché.",
    gainCents: 22000,
    effortMinutes: 25,
    riskLevel: "medium",
    confidence: 0.72,
    explain: {
      calc_steps: ["Prime actuelle 540€", "Benchmark 320€", "Écart 220€/an"],
      assumptions: ["Profil conducteur standard"],
      recommendation: "Comparer 2-3 assureurs et renégocier.",
    },
    evidence: [
      { occurred_at: "2025-09-01", amount_cents: 54000, merchant: "AssurAuto", raw_label: "ASSURAUTO PRIME" },
    ],
  },
  {
    key: "tax",
    category: "tax",
    title: "Taux PAS potentiellement surévalué",
    description: "Écart détecté entre revenus et taux PAS.",
    gainCents: 12000,
    effortMinutes: 10,
    riskLevel: "medium",
    confidence: 0.7,
    explain: {
      calc_steps: ["Taux PAS actuel 11%", "Simulation 9%"],
      assumptions: ["Revenus stables sur 12 mois"],
      recommendation: "Ajuster le taux via impots.gouv.",
    },
    evidence: [
      { occurred_at: "2025-10-15", amount_cents: 0, merchant: "Impots", raw_label: "TAUX PAS 11%" },
    ],
  },
  {
    key: "utilities",
    category: "utilities",
    title: "Forfait énergie perfectible",
    description: "Contrat énergie supérieur au marché.",
    gainCents: 9000,
    effortMinutes: 20,
    riskLevel: "medium",
    confidence: 0.65,
    explain: {
      calc_steps: ["Dépense moyenne 110€/mois", "Benchmark 102€/mois"],
      assumptions: ["Consommation moyenne foyer"],
      recommendation: "Comparer 2 offres avant renouvellement.",
    },
    evidence: [
      { occurred_at: "2025-11-20", amount_cents: 11000, merchant: "Energia", raw_label: "FACTURE ENERGIE" },
    ],
  },
  {
    key: "other",
    category: "other",
    title: "Doublon de stockage cloud",
    description: "Deux services cloud facturés en parallèle.",
    gainCents: 6000,
    effortMinutes: 5,
    riskLevel: "low",
    confidence: 0.8,
    explain: {
      calc_steps: ["2 services à 5€/mois", "10€ × 12 = 120€/an", "Gain conservateur 60€/an"],
      assumptions: ["Un seul service suffisant"],
      recommendation: "Garder un seul abonnement cloud.",
    },
    evidence: [
      { occurred_at: "2025-12-02", amount_cents: 500, merchant: "CloudBox", raw_label: "CLOUDBOX" },
      { occurred_at: "2025-12-03", amount_cents: 500, merchant: "DrivePlus", raw_label: "DRIVEPLUS" },
    ],
  },
];

const buildPlanItems = (findings: DemoFindingSeed[]) => {
  return findings.map((finding, index) => {
    const priorityScore = finding.gainCents / Math.max(finding.effortMinutes, 1);
    return {
      position: index + 1,
      action_title: finding.title,
      action_steps: [
        "Vérifier les montants",
        "Comparer avec une alternative",
        "Mettre en place le changement",
      ],
      gain_estimated_yearly_cents: finding.gainCents,
      effort_minutes: finding.effortMinutes,
      risk_level: finding.riskLevel,
      priority_score: Math.round(priorityScore * 100) / 100,
      status: "todo",
      finding_key: finding.key,
    };
  });
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

  const { data: scanRow, error: scanError } = await supabaseAdmin
    .from("scans")
    .insert({
      user_id: userId,
      status: "done",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      summary: {
        total_gain_estimated_yearly_cents: demoFindings.reduce((acc, item) => acc + item.gainCents, 0),
        top_categories: ["subscriptions", "bank_fees", "insurance"],
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
      demoFindings.map((finding) => ({
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
    const match = demoFindings.find((finding) => finding.title === row.title);
    if (match) {
      findingMap.set(match.key, row.id);
    }
  });

  const evidenceRows = demoFindings.flatMap((finding) => {
    const findingId = findingMap.get(finding.key);
    if (!findingId) return [];
    return finding.evidence.map((row) => ({
      user_id: userId,
      finding_id: findingId,
      source: "bank_transaction",
      occurred_at: row.occurred_at,
      amount_cents: row.amount_cents,
      currency: "EUR",
      merchant: row.merchant,
      raw_label: row.raw_label,
      reference: `${finding.key}-${row.occurred_at}`,
      payload: row,
    }));
  });

  const { error: evidenceError } = await supabaseAdmin.from("evidence").insert(evidenceRows);
  if (evidenceError) {
    return NextResponse.json({ error: evidenceError.message }, { status: 500 });
  }

  const totalGain = demoFindings.reduce((acc, item) => acc + item.gainCents, 0);
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

  const planItems = buildPlanItems(demoFindings).map((item) => ({
    user_id: userId,
    plan_id: planRow.id,
    finding_id: findingMap.get(item.finding_key) ?? null,
    position: item.position,
    action_title: item.action_title,
    action_steps: item.action_steps,
    gain_estimated_yearly_cents: item.gain_estimated_yearly_cents,
    effort_minutes: item.effort_minutes,
    risk_level: item.risk_level,
    priority_score: item.priority_score,
    status: item.status,
  }));

  const { error: planItemsError } = await supabaseAdmin.from("plan_items").insert(planItems);
  if (planItemsError) {
    return NextResponse.json({ error: planItemsError.message }, { status: 500 });
  }

  return NextResponse.json({ scan_id: scanRow.id, plan_id: planRow.id });
}

export async function DELETE(request: NextRequest) {
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
  const { error: deleteError } = await supabaseAdmin.from("scans").delete().eq("user_id", userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
