import { supabase } from "@/lib/supabase/client";

export const track = async (name: string, meta: Record<string, unknown> = {}) => {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return;
    await supabase.from("events").insert({
      user_id: userId,
      name,
      meta,
    });
  } catch {
    // Swallow tracking errors to avoid UX impact
  }
};
