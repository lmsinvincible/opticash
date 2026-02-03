"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EvidenceRow } from "@/components/opticash/evidence-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { routes, FEATURES } from "@/lib/config";
import { track } from "@/lib/events";
import { formatCents } from "@/lib/money";
import { findings as demoFindings } from "@/lib/mock-data";
import {
  getEvidenceForFinding,
  getFindingsForScan,
  getLatestScan,
  getSessionUser,
  updateFindingStatus,
} from "@/lib/supabase/queries";

type FindingRow = {
  id: string;
  scan_id: string;
  category: "bank_fees" | "subscriptions" | "insurance" | "tax" | "utilities" | "other";
  title: string;
  description: string | null;
  status: "open" | "snoozed" | "resolved";
  confidence: number;
  gain_estimated_yearly_cents: string | number;
  effort_minutes: number;
  risk_level: "low" | "medium" | "high";
  explain: {
    calc_steps?: string[];
    assumptions?: string[];
    recommendation?: string;
  } | null;
};

type EvidenceRowType = {
  id: string;
  occurred_at: string | null;
  amount_cents: string | number | null;
  currency: string;
  merchant: string | null;
  raw_label: string | null;
};

type ScanRow = {
  id: string;
};

const categoryLabels: Record<FindingRow["category"], string> = {
  bank_fees: "Frais bancaires",
  subscriptions: "Abonnements",
  insurance: "Assurance",
  tax: "Impôts",
  utilities: "Énergie",
  other: "Autres",
};

const statusLabels: Record<FindingRow["status"], string> = {
  open: "Ouvert",
  snoozed: "Rappel",
  resolved: "Résolu",
};

const statusTabs = [
  { label: "Tous", value: "all" },
  { label: "Ouverts", value: "open" },
  { label: "Rappels", value: "snoozed" },
  { label: "Résolus", value: "resolved" },
] as const;

const categoryFilters = [
  { label: "Tous", value: "all" },
  { label: "Frais bancaires", value: "bank_fees" },
  { label: "Abonnements", value: "subscriptions" },
  { label: "Assurance", value: "insurance" },
  { label: "Impôts", value: "tax" },
  { label: "Énergie", value: "utilities" },
  { label: "Autres", value: "other" },
] as const;

export default function FindingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanRow | null>(null);
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [category, setCategory] = useState<(typeof categoryFilters)[number]["value"]>("all");
  const [status, setStatus] = useState<(typeof statusTabs)[number]["value"]>("all");
  const [evidence, setEvidence] = useState<EvidenceRowType[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [useDemo, setUseDemo] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const user = await getSessionUser();
        if (!mounted) return;
        if (!user) {
          setUserId(null);
          return;
        }
        setUserId(user.id);
        const latestScan = await getLatestScan(user.id);
        if (!mounted) return;
        setScan(latestScan as ScanRow | null);
        if (latestScan) {
          const scanFindings = await getFindingsForScan(latestScan.id);
          if (!mounted) return;
          setFindings(scanFindings as FindingRow[]);
        } else {
          setFindings([]);
        }
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredFindings = useMemo(() => {
    const base = useDemo
      ? demoFindings.map((finding) => ({
          id: finding.id,
          scan_id: "demo",
          category: finding.category,
          title: finding.title,
          description: finding.description,
          status: "open" as const,
          confidence: 0.82,
          gain_estimated_yearly_cents: finding.yearlyLoss,
          effort_minutes: 20,
          risk_level: "low" as const,
          explain: {
            calc_steps: ["Analyse des transactions sur 12 mois", "Projection annuelle"],
            assumptions: ["Données basées sur les derniers mouvements"],
            recommendation: "Passe à une offre sans frais ou renégocie.",
          },
        }))
      : findings;

    return base.filter((finding) => {
      const matchCategory = category === "all" || finding.category === category;
      const matchStatus = status === "all" || finding.status === status;
      return matchCategory && matchStatus;
    });
  }, [category, status, findings, useDemo]);

  const groupedFindings = useMemo(() => {
    const groups: Record<string, FindingRow[]> = {};
    filteredFindings.forEach((finding) => {
      const key = finding.category;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(finding);
    });
    return groups;
  }, [filteredFindings]);

  const totalGain = useMemo(
    () =>
      filteredFindings.reduce(
        (acc, finding) => acc + Number(finding.gain_estimated_yearly_cents || 0),
        0
      ),
    [filteredFindings]
  );

  const handleOpenSheet = async (finding: FindingRow) => {
    if (useDemo) {
      setEvidence(
        demoFindings
          .find((item) => item.id === finding.id)
          ?.evidence.map((item) => ({
            id: item.id,
            occurred_at: item.date,
            amount_cents: item.amount,
            currency: "EUR",
            merchant: item.label,
            raw_label: item.label,
          })) ?? []
      );
      return;
    }
    setEvidenceLoading(true);
    try {
      const rows = await getEvidenceForFinding(finding.id, 50);
      setEvidence(rows as EvidenceRowType[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
    } finally {
      setEvidenceLoading(false);
    }
  };

  const handleStatusUpdate = async (findingId: string, nextStatus: FindingRow["status"]) => {
    setPendingIds((prev) => new Set(prev).add(findingId));
    const previous = findings;
    setFindings((current) =>
      current.map((finding) => (finding.id === findingId ? { ...finding, status: nextStatus } : finding))
    );
    try {
      await updateFindingStatus(findingId, nextStatus);
    } catch (err) {
      setFindings(previous);
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(findingId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="h-28 animate-pulse" />
        <Card className="h-40 animate-pulse" />
        <Card className="h-40 animate-pulse" />
      </div>
    );
  }

  if (!userId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connecte-toi pour voir tes fuites détectées</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href={routes.auth.login}>Se connecter</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={routes.auth.signup}>Créer un compte</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Impossible de charger les findings</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
      </Card>
    );
  }

  if (!scan && !useDemo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aucune analyse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Lance un scan pour détecter tes fuites financières.</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={routes.app.dashboard}>Retour dashboard</Link>
            </Button>
            <Button variant="outline" onClick={() => setUseDemo(true)}>
              Voir un exemple
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (scan && findings.length === 0 && !useDemo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aucune fuite détectée</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Ton dernier scan n’a pas détecté d’économies manquées.</p>
          <Button asChild>
            <Link href={routes.app.plan}>Voir mon plan</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Fuites détectées</h2>
          <p className="text-sm text-muted-foreground">Sur ton dernier scan</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={routes.app.plan}>Voir mon plan</Link>
        </Button>
      </div>

      {FEATURES.SOFT_PAYWALL && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Insights avancés (Premium)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Accède aux explications détaillées et recommandations avancées.</span>
            <Button size="sm" asChild>
              <Link href="/upgrade" onClick={() => track("upgrade_clicked", { from: "findings" })}>
                Upgrade
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">{filteredFindings.length} findings</Badge>
        <Badge variant="secondary">Gain estimé total : {formatCents(totalGain)}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {categoryFilters.map((item) => (
          <Button
            key={item.value}
            size="sm"
            variant={category === item.value ? "default" : "outline"}
            onClick={() => setCategory(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statusTabs.map((item) => (
          <Button
            key={item.value}
            size="sm"
            variant={status === item.value ? "default" : "outline"}
            onClick={() => setStatus(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {Object.entries(groupedFindings).map(([group, items]) => (
        <div key={group} className="space-y-3">
          <h3 className="text-lg font-semibold">{categoryLabels[group as FindingRow["category"]]}</h3>
          <div className="grid gap-4">
            {items.map((finding) => (
              <Sheet key={finding.id}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => handleOpenSheet(finding)}
                  >
                    <Card>
                      <CardHeader className="flex flex-row items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-base">{finding.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">{finding.description}</p>
                        </div>
                        <Badge variant="secondary">
                          {formatCents(finding.gain_estimated_yearly_cents)}/an
                        </Badge>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                        <span>Statut : {statusLabels[finding.status]}</span>
                        <span>Confiance : {(finding.confidence * 100).toFixed(0)}%</span>
                      </CardContent>
                    </Card>
                  </button>
                </SheetTrigger>
                <SheetContent className="w-full max-w-xl">
                  <SheetHeader>
                    <SheetTitle>{finding.title}</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-6">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{categoryLabels[finding.category]}</Badge>
                      <Badge variant="outline">Risque: {finding.risk_level}</Badge>
                      <Badge variant="secondary">{statusLabels[finding.status]}</Badge>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Gain estimé annuel</p>
                      <p className="text-xl font-semibold text-foreground">
                        {formatCents(finding.gain_estimated_yearly_cents)}
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span>Effort: {finding.effort_minutes} min</span>
                        <span>Confiance: {(finding.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Justification</p>
                      {finding.explain ? (
                        <div className="space-y-3 text-sm">
                          {finding.explain.calc_steps?.length ? (
                            <div>
                              <p className="font-medium">Étapes de calcul</p>
                              <ul className="mt-2 space-y-1 text-muted-foreground">
                                {finding.explain.calc_steps.map((step, index) => (
                                  <li key={`${finding.id}-step-${index}`}>{step}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {finding.explain.assumptions?.length ? (
                            <div>
                              <p className="font-medium">Hypothèses</p>
                              <ul className="mt-2 space-y-1 text-muted-foreground">
                                {finding.explain.assumptions.map((assumption, index) => (
                                  <li key={`${finding.id}-assumption-${index}`}>{assumption}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {finding.explain.recommendation ? (
                            <div>
                              <p className="font-medium">Recommandation</p>
                              <p className="text-muted-foreground">{finding.explain.recommendation}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Justification indisponible pour ce finding.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Preuves</p>
                      {evidenceLoading ? (
                        <Card className="h-20 animate-pulse" />
                      ) : evidence.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Pas de preuves disponibles.</p>
                      ) : (
                        <div className="space-y-2">
                          {evidence.map((row) => (
                              <EvidenceRow
                              key={row.id}
                              evidence={{
                                id: row.id,
                                label: row.merchant ?? row.raw_label ?? "Transaction",
                                amount: Number(row.amount_cents ?? 0),
                                date: row.occurred_at ?? "",
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={pendingIds.has(finding.id)}
                        onClick={() => handleStatusUpdate(finding.id, "resolved")}
                      >
                        Résolu
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingIds.has(finding.id)}
                        onClick={() => handleStatusUpdate(finding.id, "snoozed")}
                      >
                        Rappeler plus tard
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pendingIds.has(finding.id)}
                        onClick={() => handleStatusUpdate(finding.id, "open")}
                      >
                        Rouvrir
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
