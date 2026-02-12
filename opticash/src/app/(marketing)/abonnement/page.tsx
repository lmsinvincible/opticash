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
      "1 scan complet",
      "Plan d’économies + étapes",
      "Impôts Boost (version simple)",
      "Pas d’export PDF",
    ],
    cta: { label: "Commencer gratuitement", href: "/signup" },
  },
  {
    name: "Premium",
    price: "1,99 € / mois",
    subtitle: "Pour tester en continu",
    features: [
      "Scans illimités",
      "Détails ligne par ligne",
      "Chat IA dépenses",
      "Export PDF",
    ],
    cta: { label: "Passer premium", href: "/upgrade" },
  },
  {
    name: "Super Premium",
    price: "4,99 € / mois",
    subtitle: "Accès complet + IA avancée",
    features: [
      "Tout Premium",
      "IA avancée pour alternatives",
      "Historique complet",
      "Priorité support",
    ],
    cta: { label: "Passer Super Premium", href: "/upgrade" },
    highlight: true,
  },
];

export default function AbonnementPage() {
  return (
    <div className="min-h-screen bg-muted/40 px-6 py-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
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
