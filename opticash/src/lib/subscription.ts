export type PlanTier = "free" | "premium" | "super";

export const TIER_LIMITS = {
  free: {
    csv: 3,
    facture: 1,
    impots: 1,
    chat: 10,
    history: 10,
  },
  premium: {
    csv: 10,
    facture: 3,
    impots: 3,
    chat: 100,
    history: 20,
  },
  super: {
    csv: Infinity,
    facture: Infinity,
    impots: Infinity,
    chat: Infinity,
    history: 50,
  },
};

export const resolveTier = (profile?: { plan_tier?: string | null; is_premium?: boolean | null }) => {
  if (profile?.plan_tier === "premium" || profile?.plan_tier === "super" || profile?.plan_tier === "free") {
    return profile.plan_tier as PlanTier;
  }
  return profile?.is_premium ? "premium" : "free";
};

export const monthStartIso = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return start.toISOString();
};
