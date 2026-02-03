"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/supabase/auth";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const session = await getSession();
        if (!session && mounted) {
          router.replace("/login");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return <div className="min-h-screen bg-muted/30" />;
  }

  return <AppShell>{children}</AppShell>;
}
