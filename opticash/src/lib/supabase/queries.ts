import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export const getSessionUser = async (): Promise<User | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session?.user ?? null;
};

export const getLatestPlan = async (userId: string) => {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ?? null;
};

export const getTopPlanItems = async (planId: string, limit = 3) => {
  const { data, error } = await supabase
    .from("plan_items")
    .select("*")
    .eq("plan_id", planId)
    .order("position", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }
  return data ?? [];
};

export const getPlanItems = async (planId: string) => {
  const { data, error } = await supabase
    .from("plan_items")
    .select("*")
    .eq("plan_id", planId)
    .order("position", { ascending: true })
    .order("priority_score", { ascending: false });

  if (error) {
    throw error;
  }
  return data ?? [];
};

export const updatePlanItemStatus = async (itemId: string, status: string) => {
  const { data, error } = await supabase
    .from("plan_items")
    .update({ status })
    .eq("id", itemId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ?? null;
};

export const getLatestScan = async (userId: string) => {
  const { data, error } = await supabase
    .from("scans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ?? null;
};

export const getFindingsForScan = async (scanId: string) => {
  const { data, error } = await supabase
    .from("findings")
    .select("*")
    .eq("scan_id", scanId)
    .order("gain_estimated_yearly_cents", { ascending: false })
    .order("confidence", { ascending: false });

  if (error) {
    throw error;
  }
  return data ?? [];
};

export const getEvidenceForFinding = async (findingId: string, limit = 50) => {
  const { data, error } = await supabase
    .from("evidence")
    .select("*")
    .eq("finding_id", findingId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }
  return data ?? [];
};

export const updateFindingStatus = async (findingId: string, status: string) => {
  const { data, error } = await supabase
    .from("findings")
    .update({ status })
    .eq("id", findingId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ?? null;
};
