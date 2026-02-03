import type { EffortLevel, RiskLevel } from "@/types/opticash";

const effortWeight: Record<EffortLevel, number> = {
  low: 1,
  medium: 0.7,
  high: 0.4,
};

const riskWeight: Record<RiskLevel, number> = {
  low: 1,
  medium: 0.8,
  high: 0.6,
};

export const scoreAction = (yearlyGain: number, effort: EffortLevel, risk: RiskLevel) => {
  return Math.round(yearlyGain * effortWeight[effort] * riskWeight[risk]);
};
