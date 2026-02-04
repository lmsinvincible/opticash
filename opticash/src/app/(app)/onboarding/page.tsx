"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    title: "Bienvenue sur OptiCash !",
    subtitle: "On va trouver l’argent que tu perds tous les mois sans t’en rendre compte.",
    body:
      "En 3 minutes, on scanne tes comptes et on te montre combien tu peux récupérer facilement.",
    cta: "Commencer mon 1er scan gratuit",
    emoji: "💸",
  },
  {
    title: "Comment ça marche ?",
    subtitle: "3 étapes simples pour récupérer de l’argent chaque mois.",
    points: [
      "Importe ton relevé bancaire (CSV ou connexion sécurisée).",
      "On analyse ligne par ligne les frais, abonnements oubliés, impôts mal optimisés.",
      "Tu obtiens un plan clair avec étapes précises pour gagner 500–3 000 €/an.",
    ],
    note: "Tu as droit à 1 scan complet gratuit. Ensuite : Premium 4,99 €/mois.",
    cta: "Je suis prêt – lancer le scan",
    emoji: "✅",
  },
  {
    title: "Prêt à découvrir tes économies cachées ?",
    subtitle: "Ton premier scan peut détecter 300–1 500 € d’économies dès aujourd’hui.",
    body: "Tes données sont sécurisées et en lecture seule. Tu contrôles tout.",
    cta: "Lancer mon scan gratuit maintenant",
    emoji: "🔒",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = localStorage.getItem("opticash:onboarded");
    if (done === "1") {
      router.replace("/dashboard");
    }
  }, [router]);

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);
  const current = STEPS[step];

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((prev) => prev + 1);
      return;
    }
    localStorage.setItem("opticash:onboarded", "1");
    router.push("/import/csv");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Étape {step + 1} / {STEPS.length}</span>
          <span>Ton 1er scan est gratuit</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <Card className="border-emerald-200 bg-white/90">
          <CardHeader className="space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
              {current.emoji}
            </div>
            <CardTitle className="text-2xl">{current.title}</CardTitle>
            <p className="text-muted-foreground">{current.subtitle}</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {"points" in current && current.points ? (
              <ul className="space-y-2">
                {current.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="text-emerald-600">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{current.body}</p>
            )}
            {"note" in current && current.note ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-emerald-800">
                {current.note}
              </div>
            ) : null}
            <Button
              size="lg"
              className="w-full bg-emerald-600 text-white transition-transform hover:scale-[1.01] hover:bg-emerald-600"
              onClick={handleNext}
            >
              {current.cta}
            </Button>
            <div className="text-center text-xs text-muted-foreground">
              On se fait tous avoir un peu sans le voir… OptiCash te montre où stopper la fuite.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
