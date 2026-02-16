"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const tiers = [
  {
    name: "Gratuit",
    price: "0 €",
    subtitle: "Pour découvrir OptiCash",
    features: [
      "OptiCash : 3 scans / mois",
      "Impôts Boost : 1 analyse / mois",
      "Facture énergie : 1 analyse / mois",
      "Chat IA : 10 messages / mois",
      "Historique : 10 imports",
    ],
    cta: { label: "Commencer gratuitement", href: "/signup" },
  },
  {
    name: "Premium",
    price: "1,99 € / mois",
    subtitle: "Pour tester en continu",
    features: [
      "OptiCash : 10 scans / mois",
      "Impôts Boost : 3 analyses / mois",
      "Facture énergie : 3 analyses / mois",
      "Chat IA : 100 messages / mois",
      "Historique : 20 imports",
    ],
    cta: { label: "Passer premium", href: "/upgrade" },
  },
  {
    name: "Super Premium",
    price: "4,99 € / mois",
    subtitle: "Accès complet + IA avancée",
    features: [
      "OptiCash : illimité",
      "Impôts Boost : illimité",
      "Facture énergie : illimité",
      "Chat IA : illimité",
      "Historique : 50 imports",
    ],
    cta: { label: "Passer Super Premium", href: "/upgrade" },
    highlight: true,
  },
];

export default function AbonnementPage() {
  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild>
            <Link href="/dashboard">← Retour</Link>
          </Button>
        </div>
        <header className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold md:text-4xl">
            Choisis ton abonnement OptiCash
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Passe à l’offre qui correspond à ton niveau d’analyse et de suivi.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={`flex h-full flex-col ${
                tier.highlight
                  ? "border-emerald-300 bg-emerald-50/40 shadow-lg"
                  : "bg-background"
              }`}
            >
              <CardHeader>
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <div className="text-3xl font-semibold text-foreground">
                  {tier.price}
                </div>
                <p className="text-xs text-muted-foreground">{tier.subtitle}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-6">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {tier.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
                <Button asChild className={tier.highlight ? "bg-emerald-600 text-white hover:bg-emerald-600" : ""}>
                  <Link href={tier.cta.href}>{tier.cta.label}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
