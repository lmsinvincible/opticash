"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { track } from "@/lib/events";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

type PlanKey = "premium" | "super";

export default function UpgradePage() {
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);

  useEffect(() => {
    void track("upgrade_viewed");
  }, []);

  const handleCheckout = async (plan: PlanKey) => {
    setLoadingPlan(plan);
    try {
      void track("upgrade_checkout_started", { plan });
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error("Session invalide. Merci de vous reconnecter.");
        return;
      }
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Échec Stripe.");
      }
      const payload = await response.json();
      if (payload.url) {
        window.location.href = payload.url;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16">
        <header className="space-y-4">
          <h1 className="text-3xl font-semibold">OptiCash Premium</h1>
          <p className="text-muted-foreground">
            Débloque les analyses avancées et garde le contrôle sur tes économies.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="text-base">Gratuit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Découvrir OptiCash gratuitement.</p>
              <ul className="list-disc pl-5">
                <li>OptiCash : 3 scans / mois</li>
                <li>Impôts Boost : 1 analyse / mois</li>
                <li>Facture énergie : 1 analyse / mois</li>
                <li>Chat IA : 10 messages / mois</li>
                <li>Historique : 10 imports</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">Premium 1,99 € / mois</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <ul className="list-disc pl-5">
                <li>OptiCash : 10 scans / mois</li>
                <li>Impôts Boost : 3 analyses / mois</li>
                <li>Facture énergie : 3 analyses / mois</li>
                <li>Chat IA : 100 messages / mois</li>
                <li>Historique : 20 imports</li>
              </ul>
              <Button onClick={() => handleCheckout("premium")} disabled={loadingPlan !== null}>
                {loadingPlan === "premium" ? "Redirection..." : "Passer Premium"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/60">
            <CardHeader>
              <CardTitle className="text-base">Super Premium 4,99 € / mois</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <ul className="list-disc pl-5">
                <li>OptiCash : illimité</li>
                <li>Impôts Boost : illimité</li>
                <li>Facture énergie : illimité</li>
                <li>Chat IA : illimité</li>
                <li>Historique : 50 imports</li>
              </ul>
              <Button
                onClick={() => handleCheckout("super")}
                disabled={loadingPlan !== null}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {loadingPlan === "super" ? "Redirection..." : "Passer Super"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Besoin d’un plan entreprise ?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" asChild>
              <a href="mailto:hello@opticash.app">Contacte-nous</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
