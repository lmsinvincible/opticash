import type { DashboardSummary, Finding, PlanItem } from "@/types/opticash";

export const planItems: PlanItem[] = [
  {
    id: "plan-1",
    title: "Supprimer les frais bancaires inutiles",
    description: "Passer à une offre sans frais pour économiser 96 €/an.",
    yearlyGain: 9600,
    effort: "low",
    risk: "low",
    priority: "P1",
    ctaLabel: "Voir la justification",
  },
  {
    id: "plan-2",
    title: "Annuler un abonnement dormant",
    description: "Deux abonnements non utilisés détectés.",
    yearlyGain: 16800,
    effort: "low",
    risk: "low",
    priority: "P1",
    ctaLabel: "Voir la justification",
  },
  {
    id: "plan-3",
    title: "Renégocier l'assurance auto",
    description: "Surcoût estimé par rapport au marché.",
    yearlyGain: 21000,
    effort: "medium",
    risk: "medium",
    priority: "P2",
    ctaLabel: "Voir la justification",
  },
  {
    id: "plan-4",
    title: "Ajuster le taux PAS",
    description: "Risque de régularisation important.",
    yearlyGain: 32000,
    effort: "medium",
    risk: "low",
    priority: "P2",
    ctaLabel: "Voir la justification",
  },
  {
    id: "plan-5",
    title: "Déclarer des dons oubliés",
    description: "Déductions fiscales potentielles.",
    yearlyGain: 12000,
    effort: "medium",
    risk: "low",
    priority: "P3",
    ctaLabel: "Voir la justification",
  },
  {
    id: "plan-6",
    title: "Optimiser les frais kilométriques",
    description: "Estimation basée sur vos trajets moyens.",
    yearlyGain: 18000,
    effort: "high",
    risk: "medium",
    priority: "P3",
    ctaLabel: "Voir la justification",
  },
];

export const findings: Finding[] = [
  {
    id: "finding-1",
    title: "Frais bancaires mensuels",
    category: "bank_fees",
    yearlyLoss: 9600,
    description: "Frais de tenue de compte identifiés sur 12 mois.",
    evidence: [
      { id: "ev-1", label: "Frais tenue compte", amount: 800, date: "2025-11-12" },
      { id: "ev-2", label: "Frais tenue compte", amount: 800, date: "2025-12-12" },
    ],
  },
  {
    id: "finding-2",
    title: "Abonnements récurrents",
    category: "subscriptions",
    yearlyLoss: 16800,
    description: "Deux abonnements non utilisés détectés.",
    evidence: [
      { id: "ev-3", label: "Streaming Plus", amount: 1200, date: "2025-12-03" },
      { id: "ev-4", label: "Fitness Online", amount: 200, date: "2025-12-08" },
    ],
  },
  {
    id: "finding-3",
    title: "Assurance auto",
    category: "insurance",
    yearlyLoss: 21000,
    description: "Votre prime est supérieure au benchmark.",
    evidence: [
      { id: "ev-5", label: "Prime annuelle", amount: 54000, date: "2025-10-01" },
    ],
  },
  {
    id: "finding-4",
    title: "Taux PAS",
    category: "tax",
    yearlyLoss: 32000,
    description: "Taux PAS potentiellement surévalué.",
    evidence: [
      { id: "ev-6", label: "Taux PAS", amount: 1100, date: "2025-09-15" },
    ],
  },
];

export const dashboardSummary: DashboardSummary = {
  totalEstimatedGain: 284000,
  recoveredThisQuarter: 42000,
  topActions: planItems.slice(0, 3),
};
