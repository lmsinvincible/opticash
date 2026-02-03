export type RiskLevel = "low" | "medium" | "high";
export type EffortLevel = "low" | "medium" | "high";
export type FindingCategory = "bank_fees" | "subscriptions" | "insurance" | "tax";

export type Finding = {
  id: string;
  title: string;
  category: FindingCategory;
  yearlyLoss: number;
  description: string;
  evidence: Evidence[];
};

export type Evidence = {
  id: string;
  label: string;
  amount: number;
  date: string;
};

export type PlanItem = {
  id: string;
  title: string;
  description: string;
  yearlyGain: number;
  effort: EffortLevel;
  risk: RiskLevel;
  priority: "P1" | "P2" | "P3";
  ctaLabel: string;
};

export type DashboardSummary = {
  totalEstimatedGain: number;
  recoveredThisQuarter: number;
  topActions: PlanItem[];
};
