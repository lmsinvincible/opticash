"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { pricing } from "@/lib/config";

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/checkout", { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Impossible de démarrer le paiement.");
      }
      const { url } = (await response.json()) as { url: string };
      if (!url) throw new Error("URL Stripe manquante.");
      window.location.href = url;
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
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-16">
        <section className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">
              OptiCash Premium
            </p>
            <h1 className="text-3xl font-semibold md:text-4xl">
              Passez premium et ne ratez plus un seul euro perdu
            </h1>
            <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
              Après votre 1er scan gratuit, débloquez scans illimités, export PDF, historique et
              suivi mensuel pour seulement {pricing.monthly} €/mois.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              className="bg-emerald-600 text-white shadow-sm transition-transform hover:scale-[1.02] hover:bg-emerald-600"
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? "Redirection..." : `Passer premium – ${pricing.monthly} €/mois`}
            </Button>
            <span className="text-sm text-muted-foreground">
              Annulez quand vous voulez. Paiement sécurisé.
            </span>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Gratuit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>1 scan complet</p>
              <p>Plan priorisé + étapes actionnables</p>
              <p>Pas d’export PDF</p>
              <p>Pas de 2e scan</p>
              <p>Pas d’historique</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-emerald-200">
            <CardHeader>
              <CardTitle>Premium</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="text-2xl font-semibold text-foreground">
                {pricing.monthly} €/mois
              </p>
              <p>{pricing.yearly} €/an (économie 20 %)</p>
              <p>Scans illimités</p>
              <p>Export PDF complet</p>
              <p>Historique de tous tes scans</p>
              <p>Suivi mensuel automatique</p>
              <p>Accès prioritaire aux futures fonctionnalités</p>
              <Button
                className="w-full bg-emerald-600 text-white transition-transform hover:scale-[1.02] hover:bg-emerald-600"
                onClick={handleCheckout}
                disabled={loading}
              >
                {loading ? "Redirection..." : "Passer premium maintenant"}
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="border-emerald-200 bg-emerald-50/40">
            <CardHeader>
              <CardTitle>Garantie & rassurance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-emerald-800/80">
              <p>Garantie satisfait ou remboursé 14 jours</p>
              <p>Annulation en 1 clic à tout moment</p>
              <p>Paiement sécurisé via Stripe</p>
              <p>Aucun engagement long terme</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>FAQ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <details className="rounded-md border px-3 py-2">
                <summary className="cursor-pointer font-medium text-foreground">
                  Combien ça coûte exactement ?
                </summary>
                <p className="mt-2">
                  {pricing.monthly} €/mois ou {pricing.yearly} €/an (économie 20 %).
                </p>
              </details>
              <details className="rounded-md border px-3 py-2">
                <summary className="cursor-pointer font-medium text-foreground">
                  Puis-je annuler quand je veux ?
                </summary>
                <p className="mt-2">Oui, en 1 clic depuis ton espace client.</p>
              </details>
              <details className="rounded-md border px-3 py-2">
                <summary className="cursor-pointer font-medium text-foreground">
                  Que se passe-t-il si je ne suis pas satisfait ?
                </summary>
                <p className="mt-2">Tu es remboursé sous 14 jours.</p>
              </details>
              <details className="rounded-md border px-3 py-2">
                <summary className="cursor-pointer font-medium text-foreground">
                  Mes données sont-elles sécurisées ?
                </summary>
                <p className="mt-2">Oui, chiffrement et accès restreint (RGPD).</p>
              </details>
              <details className="rounded-md border px-3 py-2">
                <summary className="cursor-pointer font-medium text-foreground">
                  Comment je reçois mes économies ?
                </summary>
                <p className="mt-2">Tu suis chaque action et tu économises immédiatement.</p>
              </details>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-2xl border bg-muted/30 p-6 text-center">
          <h2 className="text-2xl font-semibold">Prêt à débloquer tout OptiCash ?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Débloquez tout de suite après votre premier scan.
          </p>
          <Button
            size="lg"
            className="mt-4 bg-emerald-600 text-white transition-transform hover:scale-[1.02] hover:bg-emerald-600"
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? "Redirection..." : `Passer premium maintenant – ${pricing.monthly} €/mois`}
          </Button>
        </section>
      </main>
    </div>
  );
}
