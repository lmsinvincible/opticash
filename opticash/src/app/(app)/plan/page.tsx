"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/lib/config";
import { formatCents } from "@/lib/money";
import { planItems as demoPlanItems } from "@/lib/mock-data";
import { FEATURES } from "@/lib/config";
import { track } from "@/lib/events";
import {
  getLatestPlan,
  getLatestScan,
  getProfile,
  getPlanItems,
  getSessionUser,
  updatePlanItemStatus,
} from "@/lib/supabase/queries";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

type PlanRow = {
  id: string;
  total_gain_estimated_yearly_cents: string | number;
  created_at: string;
};

type ScanRow = {
  id: string;
  created_at: string;
  tax_answers?: Record<string, number | string> | null;
  tax_generated?: boolean | null;
};

type PlanItemRow = {
  id: string;
  plan_id: string;
  finding_id: string | null;
  position: number;
  action_title: string;
  action_steps?: string[] | null;
  gain_estimated_yearly_cents: string | number;
  effort_minutes: number;
  risk_level: "low" | "medium" | "high";
  status: "todo" | "doing" | "done" | "skipped";
  category?: string | null;
  proof?: string | null;
  reasoning?: string[] | null;
  has_usage_questions?: boolean | null;
  usage_context?: {
    subscription?: string;
    monthly_price_eur?: number | null;
    currency?: string;
  } | null;
  usage_answers?: Record<string, string> | null;
  usage_alternatives?: Array<{
    name: string;
    price: number;
    gainAnnual: number;
    reason: string;
    difficulty: string;
    steps: string[];
  }> | null;
  usage_refined?: boolean | null;
};

const statusLabel: Record<PlanItemRow["status"], string> = {
  todo: "À faire",
  doing: "En cours",
  done: "Fait",
  skipped: "Ignoré",
};

const riskLabel: Record<PlanItemRow["risk_level"], string> = {
  low: "Très faible",
  medium: "Moyen",
  high: "Élevé",
};

const riskScore: Record<PlanItemRow["risk_level"], number> = {
  low: 20,
  medium: 12,
  high: 5,
};

const effortLabel = (minutes: number) => {
  if (minutes <= 10) return "Facile";
  if (minutes <= 25) return "Moyen";
  return "Élevé";
};

const calculateScore = (gainCents: number, effortMinutes: number, risk: PlanItemRow["risk_level"]) => {
  const gainEuros = gainCents / 100;
  const gainScore = Math.min(gainEuros / 50, 50);
  const effortScore = Math.max(0, 30 - effortMinutes / 2);
  const riskPoints = riskScore[risk] ?? 5;
  return Math.round(gainScore + effortScore + riskPoints);
};

const defaultSteps = (title: string) => [
  "Vérifie les transactions concernées.",
  `Connecte-toi au service lié à “${title}”.`,
  "Applique l’action recommandée.",
  "Confirme la modification.",
];

export default function PlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [scan, setScan] = useState<ScanRow | null>(null);
  const [items, setItems] = useState<PlanItemRow[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [useDemo, setUseDemo] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [usageItemId, setUsageItemId] = useState<string | null>(null);
  const [usageAnswers, setUsageAnswers] = useState({
    frequency: "",
    people: "",
    usage: "",
  });
  const [usageSaving, setUsageSaving] = useState(false);
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [taxMode, setTaxMode] = useState<"manual" | "upload">("manual");
  const [taxAnswers, setTaxAnswers] = useState({
    salary: "",
    km: "",
    children: "",
    donations: "",
    notes: "",
  });
  const [taxSaving, setTaxSaving] = useState(false);
  const [taxFile, setTaxFile] = useState<File | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrOverlay, setOcrOverlay] = useState<"idle" | "running" | "done">("idle");

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

        const [latestPlan, latestScan] = await Promise.all([
          getLatestPlan(user.id),
          getLatestScan(user.id),
        ]);
        if (!mounted) return;
        setPlan(latestPlan as PlanRow | null);
        setScan(latestScan as ScanRow | null);

        const profile = await getProfile(user.id);
        if (!mounted) return;
        setIsPremium(Boolean(profile?.is_premium));
        setIsAdmin(Boolean((profile as { is_admin?: boolean } | null)?.is_admin));

        if (latestPlan) {
          const allItems = await getPlanItems(latestPlan.id);
          if (!mounted) return;
          setItems(allItems as PlanItemRow[]);
        } else {
          setItems([]);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tax") === "1") {
      setTaxModalOpen(true);
    }
  }, []);

  const demoItems = useMemo(
    () =>
      demoPlanItems.map((item, index) => ({
        id: item.id,
        plan_id: "demo",
        finding_id: null,
        position: index + 1,
        action_title: item.title,
        action_steps: [
          "Vérifie les transactions concernées.",
          "Accède au service ou à la banque.",
          "Applique l’action recommandée.",
          "Confirme la modification.",
        ],
        gain_estimated_yearly_cents: item.yearlyGain,
        effort_minutes: item.effort === "low" ? 10 : item.effort === "medium" ? 25 : 45,
        risk_level: item.risk,
        status: "todo" as const,
        category: "general",
        proof: null,
        reasoning: [],
        has_usage_questions: false,
        usage_context: {},
        usage_answers: {},
        usage_alternatives: [],
        usage_refined: false,
      })),
    []
  );

  const totalGain = useMemo(() => {
    const sum = items.reduce((acc, item) => acc + Number(item.gain_estimated_yearly_cents || 0), 0);
    return sum;
  }, [items]);

  const remainingCount = useMemo(
    () => items.filter((item) => item.status !== "done" && item.status !== "skipped").length,
    [items]
  );

  const realizedGain = useMemo(() => {
    return items
      .filter((item) => item.status === "done")
      .reduce((acc, item) => acc + Number(item.gain_estimated_yearly_cents || 0), 0);
  }, [items]);

  const handleStatusChange = async (itemId: string, status: PlanItemRow["status"]) => {
    setPendingIds((prev) => new Set(prev).add(itemId));
    const previous = items;
    const currentItem = items.find((item) => item.id === itemId);
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, status } : item))
    );
    try {
      await updatePlanItemStatus(itemId, status);
      localStorage.setItem("opticash:dashboard_refresh", "1");
      if (status === "done" && currentItem) {
        toast.success(`Action marquée comme faite • +${formatCents(currentItem.gain_estimated_yearly_cents)} / an`);
      }
    } catch (err) {
      setItems(previous);
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    void track("pdf_export_clicked");
    try {
      if (FEATURES.HARD_PAYWALL && !isPremium && !isAdmin) {
        toast.error("Réservé aux comptes Premium.");
        return;
      }
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error("Session invalide. Merci de vous reconnecter.");
        return;
      }
      const response = await fetch("/api/plan/pdf", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Échec de l'export PDF.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "opticash-plan.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("PDF exporté");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  const handleUsageSubmit = async (itemId: string) => {
    if (!usageAnswers.frequency || !usageAnswers.people) {
      toast.error("Merci de répondre aux 2 questions obligatoires.");
      return;
    }
    setUsageSaving(true);
    try {
      const sessionResult = await supabase.auth.getSession();
      let token = sessionResult.data.session?.access_token ?? null;
      if (!token) {
        const refreshed = await supabase.auth.refreshSession();
        token = refreshed.data.session?.access_token ?? null;
      }
      if (!token) {
        toast.error("Session expirée. Merci de vous reconnecter.");
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }
      const response = await fetch("/api/ai/subscription-alternatives", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan_item_id: itemId, answers: usageAnswers }),
      });
      if (response.status === 401) {
        toast.error("Session expirée. Merci de vous reconnecter.");
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Impossible d'affiner l'abonnement.");
      }
      const payload = (await response.json()) as { item: PlanItemRow };
      if (payload.item) {
        setItems((current) =>
          current.map((item) => (item.id === payload.item.id ? payload.item : item))
        );
      }
      toast.success("Recommandation affinée");
      setUsageItemId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setUsageSaving(false);
    }
  };

  const handleTaxSubmit = async () => {
    if (taxMode === "upload" && !ocrText) {
      toast.error("Ajoute un fichier puis lance l’OCR.");
      return;
    }
    if (taxMode === "manual" && !taxAnswers.salary && !taxAnswers.km && !taxAnswers.donations) {
      toast.error("Renseigne au moins un champ pour lancer l’analyse impôts.");
      return;
    }
    setTaxSaving(true);
    try {
      const sessionResult = await supabase.auth.getSession();
      let token = sessionResult.data.session?.access_token ?? null;
      if (!token) {
        const refreshed = await supabase.auth.refreshSession();
        token = refreshed.data.session?.access_token ?? null;
      }
      if (!token) {
        toast.error("Session expirée. Merci de vous reconnecter.");
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }
      const response = await fetch("/api/ai/tax-actions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          salary: Number(taxAnswers.salary || 0),
          km: Number(taxAnswers.km || 0),
          children: Number(taxAnswers.children || 0),
          donations: Number(taxAnswers.donations || 0),
          notes: taxAnswers.notes,
          ocrText,
        }),
      });
      if (response.status === 401) {
        toast.error("Session expirée. Merci de vous reconnecter.");
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Impossible de générer les actions impôts.");
      }
      const payload = (await response.json()) as { items: PlanItemRow[] };
      if (payload.items?.length) {
        setItems((current) => [...current, ...payload.items]);
      }
      toast.success("Impôts Boost généré");
      if (typeof window !== "undefined") {
        localStorage.setItem("opticash:tax_boosted", "1");
      }
      setTaxModalOpen(false);
      setOcrText("");
      setTaxFile(null);
      setOcrProgress(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setTaxSaving(false);
    }
  };

  const handleOcr = async () => {
    if (!taxFile) {
      toast.error("Choisis un fichier PDF ou une image.");
      return;
    }
    setOcrLoading(true);
    setOcrProgress(0);
    setOcrOverlay("running");
    try {
      const { default: Tesseract } = await import("tesseract.js");
      const { data } = await Tesseract.recognize(taxFile, "fra", {
        logger: (info) => {
          if (info.status === "recognizing text" && info.progress) {
            setOcrProgress(Math.round(info.progress * 100));
          }
        },
      });
      const text = (data.text || "").trim();
      if (!text) {
        toast.error("Impossible de lire le fichier. Essaie un scan plus net.");
        return;
      }
      setOcrText(text);
      toast.success("Texte extrait. Tu peux lancer l’analyse.");
      setTaxMode("upload");
      setOcrProgress(100);
      setOcrOverlay("done");
      setTimeout(() => setOcrOverlay("idle"), 1000);
    } catch {
      toast.error("Échec OCR. Essaie un autre fichier.");
      setOcrOverlay("idle");
    } finally {
      setOcrLoading(false);
    }
  };

  const hasData = Boolean(plan || items.length);
  const showDemo = useDemo && !hasData;
  const displayItems = showDemo ? demoItems : items;
  const displayTotalGain = showDemo
    ? demoItems.reduce((acc, item) => acc + Number(item.gain_estimated_yearly_cents || 0), 0)
    : plan?.total_gain_estimated_yearly_cents ?? totalGain;

  const scoredItems = useMemo(() => {
    return displayItems
      .map((item) => {
        const gain = Number(item.gain_estimated_yearly_cents || 0);
        const score = calculateScore(gain, item.effort_minutes, item.risk_level);
        const steps =
          Array.isArray(item.action_steps) && item.action_steps.length > 0
            ? item.action_steps
            : defaultSteps(item.action_title);
        return { ...item, score, steps };
      })
      .sort((a, b) => b.score - a.score);
  }, [displayItems]);

  const taxItems = scoredItems.filter((item) => item.category === "tax");
  const coreItems = scoredItems.filter((item) => item.category !== "tax");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (taxItems.length > 0) {
      localStorage.setItem("opticash:tax_boosted", "1");
    }
  }, [taxItems.length]);

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
          <CardTitle>Connecte-toi pour accéder à ton plan</CardTitle>
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
          <CardTitle>Impossible de charger le plan</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
      </Card>
    );
  }

  if (!hasData && !showDemo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aucun plan disponible</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Lance un scan pour générer ton plan unique.</p>
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

  return (
    <div className="space-y-6">
      {showDemo && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Mode démo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Exemple de plan basé sur des données fictives.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Ton plan OptiCash</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Gain estimé : {formatCents(displayTotalGain)}</span>
          {scan?.created_at && (
            <Badge variant="outline">
              Dernière analyse : {new Date(scan.created_at).toLocaleDateString("fr-FR")}
            </Badge>
          )}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPdf}
              disabled={exporting || (FEATURES.HARD_PAYWALL && !isPremium)}
            >
              {exporting ? "Export..." : "Exporter en PDF"}
            </Button>
            {FEATURES.SOFT_PAYWALL && (
              <Button size="sm" variant="ghost" asChild>
                <Link href="/upgrade" onClick={() => track("upgrade_clicked", { from: "plan" })}>
                  Premium
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardHeader>
          <CardTitle>Économies réalisées</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-3xl font-semibold text-emerald-700">
            +{formatCents(realizedGain)}
          </div>
          <p className="mt-1 text-sm text-emerald-700/80">
            Cette année grâce à tes actions terminées.
          </p>
        </CardContent>
      </Card>

      {FEATURES.HARD_PAYWALL && !isPremium && !isAdmin && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Export PDF réservé aux comptes Premium</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Passe en Premium pour exporter et partager ton plan.</span>
            <Button size="sm" asChild>
              <Link href="/upgrade">Upgrade</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {coreItems.map((item, index) => {
          const isPending = pendingIds.has(item.id);
          const canAskUsage = Boolean(item.has_usage_questions && !item.usage_refined);
          const alternatives = item.usage_alternatives ?? [];
          return (
            <Card key={item.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>#{index + 1}</span>
                    <Badge variant="secondary">{statusLabel[item.status]}</Badge>
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                      {item.score}/100
                    </Badge>
                  </div>
                  <CardTitle className="mt-2 text-base">{item.action_title}</CardTitle>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p className="text-base font-semibold text-foreground">
                    {formatCents(item.gain_estimated_yearly_cents)}/an
                  </p>
                  <p>
                    {item.effort_minutes} min · {effortLabel(item.effort_minutes)}
                  </p>
                  <Badge variant="outline" className="mt-2">
                    Risque: {riskLabel[item.risk_level]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  {item.steps.map((step) => (
                    <li key={`${item.id}-${step}`}>{step}</li>
                  ))}
                </ol>
                {canAskUsage && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
                    <p className="font-medium text-emerald-800">
                      Optimise encore plus cet abonnement ?
                    </p>
                    <p className="text-emerald-700/80">
                      Réponds en 20 secondes pour une alternative plus adaptée.
                    </p>
                    <Button
                      size="sm"
                      className="mt-3 bg-emerald-600 text-white hover:bg-emerald-600"
                      onClick={() => {
                        setUsageItemId(item.id);
                        setUsageAnswers({ frequency: "", people: "", usage: "" });
                      }}
                    >
                      Répondre aux questions
                    </Button>
                  </div>
                )}
                {item.usage_refined && alternatives.length > 0 && (
                  <div className="rounded-lg border border-emerald-200 bg-white/80 p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-emerald-800">
                      Recommandation affinée grâce à tes réponses
                    </p>
                    <div className="mt-2 space-y-3">
                      {alternatives.map((alt) => (
                        <div key={alt.name} className="rounded-md border px-3 py-2">
                          <p className="font-medium text-foreground">{alt.name}</p>
                          <p>Prix: {alt.price} €/mois · Gain annuel: +{alt.gainAnnual} €</p>
                          <p className="text-xs">{alt.reason}</p>
                          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
                            {alt.steps?.map((step) => (
                              <li key={`${alt.name}-${step}`}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {item.status === "done" || item.status === "skipped" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => handleStatusChange(item.id, "todo")}
                      >
                        Annuler
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleStatusChange(item.id, "done")}
                        >
                          Marquer comme fait
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => handleStatusChange(item.id, "doing")}
                        >
                          En cours
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => handleStatusChange(item.id, "skipped")}
                        >
                          Ignorer
                        </Button>
                      </>
                    )}
                  </div>
                  {item.finding_id ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`${routes.app.findings}?finding=${item.finding_id}`}>
                        Voir détails
                      </Link>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      Détails indisponibles
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xl font-semibold">Impôts Boost</h3>
            <p className="text-sm text-muted-foreground">
              Économies supplémentaires possibles sur tes impôts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-200 text-emerald-700"
              onClick={() => {
                setTaxMode("manual");
                setTaxModalOpen(true);
              }}
            >
              Remplir manuellement
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-600"
              onClick={() => {
                setTaxMode("upload");
                setTaxModalOpen(true);
              }}
            >
              {taxItems.length > 0 ? "Refaire l’analyse impôts" : "Uploader avis d’impôt"}
            </Button>
          </div>
        </div>
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="space-y-2 py-4 text-sm text-emerald-900/90">
            <p className="font-medium">
              Ton taux PAS est peut-être trop élevé. Tu oublies des dons ou des km ?
            </p>
            <p>
              Récupère 800–2 500 € facilement sur tes impôts 2026.
              Commence par l’action n°1 (la plus rentable) ↓
            </p>
          </CardContent>
        </Card>
        {taxItems.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Aucune action impôts générée</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Réponds à 3 questions rapides pour obtenir tes opportunités fiscales.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {taxItems.map((item, index) => (
              <Card key={item.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>#{index + 1}</span>
                      <Badge variant="secondary">{statusLabel[item.status]}</Badge>
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                        {item.score}/100
                      </Badge>
                    </div>
                    <CardTitle className="mt-2 text-base">{item.action_title}</CardTitle>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p className="text-base font-semibold text-foreground">
                      {formatCents(item.gain_estimated_yearly_cents)}/an
                    </p>
                    <p>{item.effort_minutes} min · {effortLabel(item.effort_minutes)}</p>
                    <Badge variant="outline" className="mt-2">
                      Risque: {riskLabel[item.risk_level]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {item.proof ? (
                    <Badge variant="outline" className="w-fit bg-sky-50 text-sky-700">
                      Preuve : {item.proof}
                    </Badge>
                  ) : null}
                  {Array.isArray(item.reasoning) && item.reasoning.length > 0 ? (
                    <ul className="list-disc pl-5">
                      {item.reasoning.map((line) => (
                        <li key={`${item.id}-${line}`}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                  <ol className="list-decimal space-y-1 pl-5">
                    {item.steps.map((step) => (
                      <li key={`${item.id}-${step}`}>{step}</li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-4 z-10 mx-auto w-full max-w-4xl rounded-xl border bg-background px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>Gain estimé : {formatCents(displayTotalGain)}</span>
          <span>Actions restantes : {showDemo ? demoItems.length : remainingCount}</span>
        </div>
      </div>

      {usageItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-background p-6 shadow-lg">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Optimise ton abonnement</h3>
              <p className="text-sm text-muted-foreground">
                Réponds en 20 secondes pour obtenir une alternative plus adaptée.
              </p>
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Fréquence d’utilisation</label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={usageAnswers.frequency}
                  onChange={(event) =>
                    setUsageAnswers((prev) => ({ ...prev, frequency: event.target.value }))
                  }
                >
                  <option value="">Sélectionner</option>
                  <option value="Tous les jours / plusieurs fois par semaine">
                    Tous les jours / plusieurs fois par semaine
                  </option>
                  <option value="1–2 fois par semaine">1–2 fois par semaine</option>
                  <option value="1 fois par mois ou moins">1 fois par mois ou moins</option>
                  <option value="Presque jamais">Presque jamais</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Nombre de personnes / appareils</label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={usageAnswers.people}
                  onChange={(event) =>
                    setUsageAnswers((prev) => ({ ...prev, people: event.target.value }))
                  }
                >
                  <option value="">Sélectionner</option>
                  <option value="Seul / 1 appareil">Seul / 1 appareil</option>
                  <option value="En couple / famille / plusieurs écrans">
                    En couple / famille / plusieurs écrans
                  </option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Usage principal (optionnel)</label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={usageAnswers.usage}
                  onChange={(event) =>
                    setUsageAnswers((prev) => ({ ...prev, usage: event.target.value }))
                  }
                >
                  <option value="">Sélectionner</option>
                  <option value="Films/séries">Films/séries</option>
                  <option value="Musique en déplacement">Musique en déplacement</option>
                  <option value="Design / création">Design / création</option>
                  <option value="Réseautage pro">Réseautage pro</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={() => setUsageItemId(null)}
                disabled={usageSaving}
              >
                Passer
              </Button>
              <Button
                onClick={() => handleUsageSubmit(usageItemId)}
                disabled={usageSaving}
                className="bg-emerald-600 text-white hover:bg-emerald-600"
              >
                {usageSaving ? "Analyse..." : "Valider mes réponses"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {taxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-background p-6 shadow-lg">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Impôts Boost</h3>
              <p className="text-sm text-muted-foreground">
                Choisis un mode rapide ou upload un avis d’impôt pour plus de précision.
              </p>
            </div>
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-800">
              Ton fichier est analysé dans ton navigateur et supprimé immédiatement après.
            </div>
            <div className="mt-4 grid gap-4 text-sm">
              <div className="grid gap-3">
                <label className="text-xs text-muted-foreground">Uploader mon avis d’impôt (PDF ou image)</label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(event) => setTaxFile(event.target.files?.[0] ?? null)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOcr}
                  disabled={ocrLoading || !taxFile}
                >
                  {ocrLoading ? `OCR... ${ocrProgress}%` : "Extraire le texte (OCR)"}
                </Button>
                {ocrText && (
                  <p className="text-xs text-emerald-700">
                    Texte extrait. Tu peux lancer l’analyse.
                  </p>
                )}
              </div>
              {taxMode === "manual" && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Salaire mensuel moyen (€)</label>
                    <input
                      className="w-full rounded-md border px-3 py-2"
                      value={taxAnswers.salary}
                      onChange={(event) => setTaxAnswers((prev) => ({ ...prev, salary: event.target.value }))}
                      placeholder="2800"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Km domicile-travail / an</label>
                    <input
                      className="w-full rounded-md border px-3 py-2"
                      value={taxAnswers.km}
                      onChange={(event) => setTaxAnswers((prev) => ({ ...prev, km: event.target.value }))}
                      placeholder="12000"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Enfants à charge</label>
                    <input
                      className="w-full rounded-md border px-3 py-2"
                      value={taxAnswers.children}
                      onChange={(event) => setTaxAnswers((prev) => ({ ...prev, children: event.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Dons estimés (€)</label>
                    <input
                      className="w-full rounded-md border px-3 py-2"
                      value={taxAnswers.donations}
                      onChange={(event) => setTaxAnswers((prev) => ({ ...prev, donations: event.target.value }))}
                      placeholder="200"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Autres infos (optionnel)</label>
                    <textarea
                      className="w-full rounded-md border px-3 py-2"
                      value={taxAnswers.notes}
                      onChange={(event) => setTaxAnswers((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Télétravail, primes, etc."
                    />
                  </div>
                </>
              )}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setTaxModalOpen(false)} disabled={taxSaving}>
                Passer
              </Button>
              <Button
                onClick={handleTaxSubmit}
                disabled={taxSaving}
                className="bg-emerald-600 text-white hover:bg-emerald-600"
              >
                {taxSaving ? "Analyse..." : "Valider mes réponses"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {ocrOverlay !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl bg-background p-6 text-center shadow-lg">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            <h3 className="text-lg font-semibold">
              {ocrOverlay === "done"
                ? "Analyse terminée !"
                : "Analyse de ton avis d’impôt en cours… (5–15 secondes)"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Traitement local sur ton appareil – tes données sont supprimées juste après. RGPD
              compliant.
            </p>
            <div className="mt-4">
              <progress
                className="h-2 w-full overflow-hidden rounded-full"
                value={ocrProgress}
                max={100}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
