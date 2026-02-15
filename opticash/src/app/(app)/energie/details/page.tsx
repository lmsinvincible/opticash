"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExpensesChat } from "@/components/expenses/expenses-chat";

type EnergyContext = {
  type: "energy";
  source?: "upload" | "manual";
  customerType?: "particulier" | "professionnel";
  postalCode?: string;
  optionTarif?: string;
  yearlyKwh?: number;
  priceKwhBase?: number | string;
  monthlySubElec?: number | string;
  yearly?: number;
  bestOffer?: { name: string; yearly: number };
  savings?: number;
  recommendation?: "changer" | "garder";
};

export default function EnergyDetailsPage() {
  const [context, setContext] = useState<EnergyContext | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("opticash:energy-context");
    if (raw) {
      try {
        setContext(JSON.parse(raw));
      } catch {
        setContext(null);
      }
    }
  }, []);

  const summary = useMemo(
    () => ({
      type: "energy",
      page: "/energie/details",
      context: context ?? {},
      note:
        "Distingue toujours pro/particulier. Si pro, recommander courtiers énergie. Si particulier, expliquer changement gratuit.",
    }),
    [context]
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">
          Tout savoir sur le marché de l’énergie et comment changer d’offre
        </h1>
        <p className="text-sm text-muted-foreground">
          Synthèse claire pour comprendre les prix, les offres et les démarches.
        </p>
      </div>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Fonctionnement du marché de l’énergie</h2>
        <p className="text-sm text-muted-foreground">
          Le marché de l’énergie en France est libéralisé depuis 2007. Les prix varient en
          fonction du marché de gros (EPEX Spot), des offres fixes ou indexées des fournisseurs.
          Les offres changent plusieurs fois par semaine, voire par jour pour les prix spot.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Offres fixes : prix stable 1–3 ans.</li>
          <li>Offres indexées : suit le TRV ou le marché.</li>
          <li>TRV : ajusté 1–2 fois/an par la CRE.</li>
        </ul>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Horaires d’ouverture / fermeture du marché</h2>
        <p className="text-sm text-muted-foreground">
          Le marché de gros (EPEX Spot) est ouvert 24/7, mais les offres fournisseurs sont mises à
          jour en semaine (lundi-vendredi, 9h–18h). Pour changer d’offre : évite les weekends
          (délai plus long).
        </p>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Comment changer facilement d’offre</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Compare sur energie-info.fr ou notre outil.</li>
          <li>Choisis une nouvelle offre (le fournisseur s’occupe du changement gratuit).</li>
          <li>Fournis tes références compteur (PDL/PRM pour élec, PCE pour gaz).</li>
          <li>Valide – l’ancien contrat est résilié automatiquement (préavis 1 mois max).</li>
        </ol>
        <p className="text-sm text-muted-foreground">
          Pour particulier : gratuit et sans coupure. Pour pro : vérifie engagement (jusqu’à 3
          ans parfois).
        </p>
      </Card>

      <div className="flex flex-col items-center gap-3">
        <Button
          className="bg-blue-700 text-white shadow-lg transition hover:scale-[1.02] hover:bg-blue-800"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("opticash:open-chat"));
            }
          }}
        >
          Demander au chatbot
        </Button>
        <p className="text-xs text-muted-foreground">
          Le chatbot utilise tes données de facture pour répondre au mieux.
        </p>
      </div>

      <ExpensesChat summary={summary} title="Assistant énergie" />
    </div>
  );
}
