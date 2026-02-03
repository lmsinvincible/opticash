"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { track } from "@/lib/events";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function UpgradePage() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void track("upgrade_viewed");
  }, []);

  const handleCheckout = async (interval: "monthly" | "yearly") => {
    setLoading(true);
    try {
      void track("upgrade_checkout_started", { interval });
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
        body: JSON.stringify({ interval }),
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
      setLoading(false);
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
          {[
            {
              title: "Scans illimités",
              body: "Importe autant de fichiers que nécessaire et compare tes économies.",
            },
            {
              title: "Insights avancés",
              body: "Accède aux explications détaillées et aux recommandations avancées.",
            },
            {
              title: "Export PDF",
              body: "Génère un plan partageable prêt à envoyer ou imprimer.",
            },
          ].map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{item.body}</CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rejoindre la liste Premium</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button onClick={() => handleCheckout("monthly")} disabled={loading}>
              {loading ? "Redirection..." : "Passer Premium (Mensuel)"}
            </Button>
            <Button variant="outline" onClick={() => handleCheckout("yearly")} disabled={loading}>
              Annuel
            </Button>
            <Button variant="ghost" asChild>
              <a href="mailto:hello@opticash.app">Contacte-nous</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
