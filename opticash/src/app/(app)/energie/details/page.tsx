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

  const money = (value?: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value ?? 0);

  const isPro = context?.customerType === "professionnel";
  const currentCost = context?.yearly ?? 0;
  const bestOfferCost = context?.bestOffer?.yearly ?? Math.max(0, Math.round(currentCost * 0.9));
  const savings = context?.savings ?? Math.max(0, currentCost - bestOfferCost);

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

      <Card className="space-y-4 border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            {isPro ? "Pourquoi changer d’offre pro maintenant ?" : "Pourquoi changer d’offre maintenant ?"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Les prix du marché de l’énergie changent plusieurs fois par semaine, voire par jour
            pour les offres spot (marché EPEX). Avec ton coût actuel de{" "}
            <span className="font-semibold text-foreground">{money(currentCost)} / an</span>, la
            meilleure offre du jour est à{" "}
            <span className="font-semibold text-foreground">{money(bestOfferCost)} / an</span>, soit
            une économie immédiate de{" "}
            <span className="font-semibold text-emerald-700">{money(savings)} / an</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            C’est le moment de changer : les prix risquent de monter rapidement. Agis vite pour
            verrouiller une offre avantageuse.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm font-semibold text-emerald-800">
          {money(savings)} d’économie / an
        </div>
        {isPro ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Vérifie ton contrat actuel (échéance, engagement, préavis – souvent 3 mois).</li>
            <li>Compare les offres pro sur energie-info.fr ou via un courtier.</li>
            <li>
              Contacte un courtier spécialisé pour des prix négociés :
              <div className="mt-2 space-y-1 text-sm text-foreground">
                <div>Selectra Pro (pro.selectra.info / 09 75 18 41 65)</div>
                <div>HelloWatt Pro (pro.hellowatt.fr / 01 76 36 19 13)</div>
                <div>Opéra Énergie (opera-energie.com / 04 72 44 97 50)</div>
              </div>
            </li>
            <li>Choisis et valide – le courtier s’occupe de tout sans coupure.</li>
          </ol>
        ) : (
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Compare les offres sur energie-info.fr.</li>
            <li>
              Choisis un nouveau fournisseur (gratuit, sans coupure, il s’occupe de la résiliation).
            </li>
            <li>Fournis ton numéro compteur (PDL pour élec, PCE pour gaz).</li>
            <li>Valide – c’est fait en 5 min ! Préavis max 1 mois.</li>
          </ol>
        )}
      </Card>

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
              const prompt = [
                "Salut ! Je suis là pour t’aider sur le marché de l’énergie. Voici tes infos actuelles :",
                `Coût annuel estimé : ${money(currentCost)}`,
                `Meilleure offre simulée : ${money(bestOfferCost)} / an chez ${
                  context?.bestOffer?.name ?? "Offre simulée"
                }`,
                `Économie potentielle : ${money(savings)} / an`,
                `Statut : ${isPro ? "professionnel" : "particulier"}`,
                isPro
                  ? "Pour pro : je peux te renvoyer vers des courtiers spécialisés avec sites/tél."
                  : "",
                "Pose-moi une question, par exemple : “Comment changer d’offre ?” ou “Pourquoi les prix changent si vite ?”",
              ]
                .filter(Boolean)
                .join("\n");
              window.dispatchEvent(
                new CustomEvent("opticash:open-chat", { detail: { prompt } })
              );
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
