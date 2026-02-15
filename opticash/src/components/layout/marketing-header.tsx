 "use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { appName, routes } from "@/lib/config";
import { supabase } from "@/lib/supabase/client";

export const MarketingHeader = () => {
  const [loading, setLoading] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        setLoading(false);
        return;
      }
      setSessionEmail(session.user.email ?? null);
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", session.user.id)
        .maybeSingle();
      if (profile) {
        const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
        setProfileName(name || null);
        setAvatarUrl(profile.avatar_url ?? null);
      }
      setLoading(false);
    };
    load();
  }, []);

  const isAuthenticated = Boolean(sessionEmail);
  const homeHref = isAuthenticated ? routes.app.dashboard : routes.marketing.home;

  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href={homeHref} className="text-lg font-semibold">
          {appName}
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href={routes.marketing.pricing}>Tarifs</Link>
          <Link href={routes.marketing.privacy}>Confidentialité</Link>
          <Link href="/cgu">CGU</Link>
        </nav>
        <div className="flex items-center gap-3">
          {loading ? null : isAuthenticated ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-8 w-8 rounded-full border border-emerald-200 object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700">
                  {(profileName ?? sessionEmail ?? "U").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden flex-col text-left leading-tight sm:flex">
                <span className="text-xs font-semibold text-foreground">
                  {profileName || "Mon profil"}
                </span>
                <span className="text-[11px]">{sessionEmail}</span>
              </div>
              <Button size="sm" asChild>
                <Link href={routes.app.dashboard}>Mon espace</Link>
              </Button>
            </div>
          ) : (
            <>
              <Link href={routes.auth.login} className="text-sm text-muted-foreground">
                Se connecter
              </Link>
              <Button asChild>
                <Link href={routes.auth.signup}>Commencer</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
