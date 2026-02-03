import type { Provider, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export const getSession = async (): Promise<Session | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session ?? null;
};

export const signInWithPassword = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
  return data;
};

export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw error;
  }
  return data;
};

export const signInWithOAuth = async (provider: Provider) => {
  const { data, error } = await supabase.auth.signInWithOAuth({ provider });
  if (error) {
    throw error;
  }
  return data;
};

export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    throw error;
  }
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
};
