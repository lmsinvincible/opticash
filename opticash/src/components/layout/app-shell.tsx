import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { routes } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getSession, signOut } from "@/lib/supabase/auth";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: routes.app.dashboard },
  { label: "Plan", href: routes.app.plan },
  { label: "Findings", href: routes.app.findings },
  { label: "Importer CSV", href: "/import/csv" },
  { label: "Settings", href: routes.app.settings },
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const session = await getSession();
        if (!mounted) return;
        setEmail(session?.user.email ?? null);
      } catch {
        if (!mounted) return;
        setEmail(null);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.push(routes.marketing.home);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
        <aside className="hidden w-64 flex-col gap-6 rounded-xl border bg-background p-6 lg:flex">
          <div>
            <p className="text-xs uppercase text-muted-foreground">OptiCash</p>
            <p className="text-lg font-semibold">Vue d'ensemble</p>
          </div>
          <Separator />
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm transition hover:bg-muted ${
                  pathname?.startsWith(item.href)
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Separator />
          <Button variant="outline" size="sm">
            Export PDF (bientôt)
          </Button>
        </aside>

        <main className="flex-1">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-background px-6 py-4">
            <div>
              <p className="text-xs uppercase text-muted-foreground">OptiCash</p>
              <h1 className="text-xl font-semibold">Pilotage des économies</h1>
            </div>
            <div className="flex items-center gap-3">
              {email ? (
                <span className="text-xs text-muted-foreground">{email}</span>
              ) : null}
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Se déconnecter
              </Button>
              <Button variant="outline" size="sm">
                Ajouter une source
              </Button>
              <Button size="sm">Voir mon plan</Button>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
};
