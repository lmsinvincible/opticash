"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
};

type PlanItemRow = {
  id: string;
  plan_id: string;
  finding_id: string | null;
  position: number;
  action_title: string;
  gain_estimated_yearly_cents: string | number;
  effort_minutes: number;
  risk_level: "low" | "medium" | "high";
  status: "todo" | "doing" | "done" | "skipped";
};

const statusLabel: Record<PlanItemRow["status"], string> = {
  todo: "À faire",
  doing: "En cours",
  done: "Fait",
  skipped: "Ignoré",
};

export default function PlanPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [scan, setScan] = useState<ScanRow | null>(null);
  const [items, setItems] = useState<PlanItemRow[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [useDemo, setUseDemo] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

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

  const demoItems = useMemo(
    () =>
      demoPlanItems.map((item, index) => ({
        id: item.id,
        plan_id: "demo",
        finding_id: null,
        position: index + 1,
        action_title: item.title,
        gain_estimated_yearly_cents: item.yearlyGain,
        effort_minutes: item.effort === "low" ? 10 : item.effort === "medium" ? 25 : 45,
        risk_level: item.risk,
        status: "todo" as const,
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

  const handleStatusChange = async (itemId: string, status: PlanItemRow["status"]) => {
    setPendingIds((prev) => new Set(prev).add(itemId));
    const previous = items;
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, status } : item))
    );
    try {
      await updatePlanItemStatus(itemId, status);
      localStorage.setItem("opticash:dashboard_refresh", "1");
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
      if (FEATURES.HARD_PAYWALL && !isPremium) {
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

  const hasData = Boolean(plan || items.length);
  const showDemo = useDemo && !hasData;
  const displayItems = showDemo ? demoItems : items;
  const displayTotalGain = showDemo
    ? demoItems.reduce((acc, item) => acc + Number(item.gain_estimated_yearly_cents || 0), 0)
    : plan?.total_gain_estimated_yearly_cents ?? totalGain;

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

      {FEATURES.HARD_PAYWALL && !isPremium && (
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
        {displayItems.map((item) => {
          const isPending = pendingIds.has(item.id);
          return (
            <Card key={item.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>#{item.position}</span>
                    <Badge variant="secondary">{statusLabel[item.status]}</Badge>
                  </div>
                  <CardTitle className="mt-2 text-base">{item.action_title}</CardTitle>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p className="text-base font-semibold text-foreground">
                    {formatCents(item.gain_estimated_yearly_cents)}/an
                  </p>
                  <p>{item.effort_minutes} min</p>
                  <Badge variant="outline" className="mt-2">
                    Risque: {item.risk_level}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
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
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="sticky bottom-4 z-10 mx-auto w-full max-w-4xl rounded-xl border bg-background px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>Gain estimé : {formatCents(displayTotalGain)}</span>
          <span>Actions restantes : {showDemo ? demoItems.length : remainingCount}</span>
        </div>
      </div>
    </div>
  );
}
