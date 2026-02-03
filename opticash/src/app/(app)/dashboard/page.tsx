"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GainCard } from "@/components/opticash/gain-card";
import { PlanItemCard } from "@/components/opticash/plan-item";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { routes } from "@/lib/config";
import { dashboardSummary, planItems } from "@/lib/mock-data";
import { formatCents } from "@/lib/money";
import { getLatestPlan, getLatestScan, getPlanItems, getSessionUser, getTopPlanItems } from "@/lib/supabase/queries";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { PlanItem } from "@/types/opticash";

type PlanRow = {
  id: string;
  total_gain_estimated_yearly_cents: string | number;
  created_at: string;
};

type ScanRow = {
  id: string;
  summary: Record<string, unknown> | null;
  created_at: string;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [scan, setScan] = useState<ScanRow | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [allItems, setAllItems] = useState<PlanItem[]>([]);
  const [useDemo, setUseDemo] = useState(false);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [demoActive, setDemoActive] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await getSessionUser();
      if (!mountedRef.current) return;
      if (!user) {
        setUserId(null);
        return;
      }
      setUserId(user.id);

      const [latestPlan, latestScan] = await Promise.all([
        getLatestPlan(user.id),
        getLatestScan(user.id),
      ]);
      if (!mountedRef.current) return;
      setPlan(latestPlan as PlanRow | null);
      setScan(latestScan as ScanRow | null);

      if (latestPlan) {
        const topItems = await getTopPlanItems(latestPlan.id, 3);
        if (!mountedRef.current) return;
        setItems(topItems as PlanItem[]);
        const allPlanItems = await getPlanItems(latestPlan.id);
        if (!mountedRef.current) return;
        setAllItems(allPlanItems as PlanItem[]);
        setDemoActive(false);
      } else {
        setItems([]);
        setAllItems([]);
        setDemoActive(false);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const flag = localStorage.getItem("opticash:dashboard_refresh");
    if (flag === "1") {
      localStorage.removeItem("opticash:dashboard_refresh");
      void loadData();
    }
  }, [loadData]);

  const demoSummary = useMemo(() => dashboardSummary, []);
  const demoItems = useMemo(() => planItems.slice(0, 3), []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="h-32 animate-pulse" />
          <Card className="h-32 animate-pulse" />
        </div>
        <Card className="h-64 animate-pulse" />
      </div>
    );
  }

  if (!userId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connecte-toi pour voir ton tableau de bord</CardTitle>
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
          <CardTitle>Impossible de charger les données</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
      </Card>
    );
  }

  const handleDemoScan = async () => {
    setCreatingDemo(true);
    toast("Scan en cours…");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error("Session invalide. Merci de vous reconnecter.");
        return;
      }
      const response = await fetch("/api/scans/demo", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Échec de création du scan.");
      }
      toast.success("Scan démo créé");
      const latestPlan = await getLatestPlan(userId);
      const latestScan = await getLatestScan(userId);
      setPlan(latestPlan as PlanRow | null);
      setScan(latestScan as ScanRow | null);
      if (latestPlan) {
        const topItems = await getTopPlanItems(latestPlan.id, 3);
        setItems(topItems as PlanItem[]);
        const allPlanItems = await getPlanItems(latestPlan.id);
        setAllItems(allPlanItems as PlanItem[]);
      }
      setDemoActive(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setCreatingDemo(false);
    }
  };

  const handleResetDemo = async () => {
    setResettingDemo(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error("Session invalide. Merci de vous reconnecter.");
        return;
      }
      const response = await fetch("/api/scans/demo", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Échec de la réinitialisation.");
      }
      toast.success("Données démo réinitialisées");
      setPlan(null);
      setScan(null);
      setItems([]);
      setAllItems([]);
      setDemoActive(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setResettingDemo(false);
    }
  };

  const hasData = Boolean(plan || scan || items.length);
  const showDemo = useDemo && !hasData;
  const hasDoneAction = allItems.some((item) => item.status === "done");

  if (!hasData && !showDemo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>On démarre ensemble</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Complète ces 3 étapes pour activer ton plan OptiCash.</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span>1. Lancer un scan démo</span>
              <span className="text-xs text-muted-foreground">En attente</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span>2. Voir ton plan</span>
              <span className="text-xs text-muted-foreground">À venir</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span>3. Marquer 1 action comme faite</span>
              <span className="text-xs text-muted-foreground">À venir</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleDemoScan} disabled={creatingDemo}>
              {creatingDemo ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Scan en cours…
                </span>
              ) : (
                "Lancer un scan démo"
              )}
            </Button>
            <Button variant="outline" disabled={creatingDemo}>
              Importer un CSV/PDF
            </Button>
            <Button variant="secondary" onClick={() => setUseDemo(true)} disabled={creatingDemo}>
              Voir un exemple
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalGain =
    showDemo ? demoSummary.totalEstimatedGain : plan?.total_gain_estimated_yearly_cents ?? 0;
  const topItems = showDemo ? demoItems : items;
  const scanSummary = showDemo
    ? { total_gain_estimated_yearly_cents: demoSummary.totalEstimatedGain }
    : (scan?.summary ?? {});

  return (
    <div className="space-y-6">
      {showDemo && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Mode démo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Aperçu basé sur des données fictives. Connecte tes comptes pour un plan réel.
          </CardContent>
        </Card>
      )}

      {demoActive && (
        <Card>
          <CardHeader>
            <CardTitle>Mode démo actif</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Ton plan démo est prêt.</span>
            <Button size="sm" asChild>
              <Link href={routes.app.plan}>Voir mon plan</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={routes.app.findings}>Voir les fuites</Link>
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" disabled={resettingDemo}>
                  {resettingDemo ? "Reset..." : "Réinitialiser la démo"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Réinitialiser la démo ?</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Cette action supprime les scans, plans et findings démo associés à votre compte.
                </p>
                <DialogFooter className="mt-4">
                  <DialogClose asChild>
                    <Button variant="outline">Annuler</Button>
                  </DialogClose>
                  <Button onClick={handleResetDemo} disabled={resettingDemo}>
                    Confirmer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <GainCard
          title="Gain estimé annuel"
          value={Number(totalGain)}
          subtitle="Basé sur votre dernier plan disponible."
        />
        <Card>
          <CardHeader>
            <CardTitle>Dernier scan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Résumé rapide de la dernière analyse.</p>
            <p className="text-base font-semibold text-foreground">
              {formatCents(
                (scanSummary as { total_gain_estimated_yearly_cents?: string | number })
                  .total_gain_estimated_yearly_cents ?? 0
              )}{" "}
              estimés
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Top 3 actions</CardTitle>
          <Button size="sm" variant="outline" asChild>
            <Link href={routes.app.plan}>Voir le plan</Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          {topItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune action prioritaire pour le moment.</p>
          ) : (
            topItems.map((item) => <PlanItemCard key={item.id} item={item} />)
          )}
        </CardContent>
      </Card>

      {demoActive && (
        <Card>
          <CardHeader>
            <CardTitle>Guided seed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span>1. Scan démo lancé</span>
              <span className="text-xs text-emerald-600">Fait</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span>2. Voir le plan</span>
              <span className="text-xs text-muted-foreground">À faire</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span>3. Marquer 1 action comme faite</span>
              <span className={hasDoneAction ? "text-xs text-emerald-600" : "text-xs text-muted-foreground"}>
                {hasDoneAction ? "Fait" : "À faire"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
