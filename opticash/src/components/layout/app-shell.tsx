import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { routes } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getSession, signOut } from "@/lib/supabase/auth";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ExpensesChat } from "@/components/expenses/expenses-chat";

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [taxBoosted, setTaxBoosted] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const session = await getSession();
        if (!mounted) return;
        setEmail(session?.user.email ?? null);
        const cachedAvatar = typeof window !== "undefined" ? localStorage.getItem("opticash:avatar_url") : null;
        const cachedVersion = typeof window !== "undefined" ? localStorage.getItem("opticash:avatar_version") : null;
        if (cachedAvatar) {
          setAvatarUrl(cachedAvatar);
        }
        if (cachedVersion) {
          setAvatarVersion(cachedVersion);
        }
        if (session?.user.id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("avatar_url, is_premium")
            .eq("id", session.user.id)
            .maybeSingle();
          setAvatarUrl(profile?.avatar_url ?? null);
          setIsPremium(Boolean(profile?.is_premium));
        }
      } catch {
        if (!mounted) return;
        setEmail(null);
        setAvatarUrl(null);
        setIsPremium(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      const cachedAvatar = typeof window !== "undefined" ? localStorage.getItem("opticash:avatar_url") : null;
      const cachedVersion = typeof window !== "undefined" ? localStorage.getItem("opticash:avatar_version") : null;
      if (cachedAvatar) {
        setAvatarUrl(cachedAvatar);
      }
      if (cachedVersion) {
        setAvatarVersion(cachedVersion);
      }
    };
    window.addEventListener("opticash:avatar_updated", handler);
    return () => window.removeEventListener("opticash:avatar_updated", handler);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const readFlag = () => {
      setTaxBoosted(localStorage.getItem("opticash:tax_boosted") === "1");
    };
    readFlag();
    window.addEventListener("storage", readFlag);
    return () => {
      window.removeEventListener("storage", readFlag);
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.push(routes.marketing.home);
  };

  if (pathname?.startsWith("/onboarding")) {
    return <div className="min-h-screen bg-muted/30">{children}</div>;
  }

  const showChatToggle = true;

  const handleOpenChat = () => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("opticash:open-chat", "1");
    } catch {
      // ignore storage failures
    }
    window.dispatchEvent(new Event("opticash:open-chat"));
  };


  const isAuthenticated = Boolean(email);
  const showGlobalChat = isAuthenticated && !pathname?.startsWith("/expenses");

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
        <aside className="hidden w-64 flex-col gap-6 rounded-xl border bg-background p-6 lg:flex lg:sticky lg:top-6 lg:self-start">
          <div>
            <Link href={routes.marketing.home} className="inline-flex flex-col">
              <span className="text-xs uppercase text-muted-foreground">OptiCash</span>
              <span className="text-lg font-semibold">Vue d&apos;ensemble</span>
            </Link>
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
            {showChatToggle ? (
              <button
                type="button"
                onClick={handleOpenChat}
                className="rounded-lg bg-gradient-to-r from-slate-900 via-indigo-600 to-cyan-500 px-3 py-2 text-left text-sm font-medium text-white shadow-sm transition hover:from-slate-900 hover:via-indigo-500 hover:to-cyan-400"
              >
                Chat IA
              </button>
            ) : null}
          </nav>
          <Separator />
          <Button variant="outline" size="sm" asChild>
            <Link href="/import/csv">Refaire plan OptiCash</Link>
          </Button>
          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-600" asChild>
            <Link href="/plan?tax=1">{taxBoosted ? "Refaire boost impôts" : "Lancer Impôts Boost"}</Link>
          </Button>
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white p-4 shadow-xl">
            <h3 className="text-center text-sm font-semibold text-foreground">
              Vérifier si je dois changer d&apos;offre (électricité / gaz)
            </h3>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Dépose ta facture (ou renseigne tes infos), et on compare ton contrat aux offres
              disponibles aujourd&apos;hui sur le comparateur officiel du Médiateur national de
              l&apos;énergie (Énergie-Info).
            </p>
            <div className="mt-4 grid gap-2">
              {[
                "🔍 Comparaison instantanée → on te dit si tu peux payer moins cher et de combien",
                "💰 Économies estimées → montant annuel + mensualité potentielle",
                "🚀 Étapes claires → liens directs + démarches expliquées",
              ].map((item) => (
                <div key={item} className="rounded-lg border bg-white px-3 py-2 text-xs">
                  {item}
                </div>
              ))}
            </div>
            <ol className="mt-4 list-decimal space-y-2 pl-4 text-[11px] text-muted-foreground">
              <li>
                Tu ajoutes ta facture (PDF ou scan) ou tes infos clés : prix du kWh, abonnement,
                option tarifaire (Base / HP-HC), consommation annuelle.
              </li>
              <li>
                On estime ton coût annuel actuel et on le compare en temps réel aux offres du marché
                via le comparateur officiel Énergie-Info.
              </li>
              <li>
                Tu reçois une recommandation claire : Garder ton offre actuelle / Changer →
                économies estimées + meilleur fournisseur.
              </li>
              <li>
                Particulier : changement gratuit et sans coupure (le nouveau fournisseur
                s&apos;occupe de tout).
              </li>
              <li>
                Professionnel : on vérifie d&apos;abord ton contrat (échéance, engagement, préavis)
                avant de conseiller.
              </li>
            </ol>
            <Button size="sm" className="mt-4 w-full bg-blue-800 text-white shadow-lg transition hover:scale-[1.02] hover:bg-blue-900" asChild>
              <Link href="/energie">⚡ Analyser ma facture</Link>
            </Button>
            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              Comparaison basée sur les données du comparateur officiel Énergie-Info (Médiateur
              national de l&apos;énergie). Service gratuit – aucune démarche engagée sans ton accord.
            </p>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Les offres d&apos;électricité et de gaz évoluent plusieurs fois par semaine, voire par
              jour. La comparaison que nous te proposons est basée sur les données officielles
              disponibles à l&apos;instant T via le comparateur du Médiateur national de l&apos;énergie. Pour
              une offre 100 % à jour, vérifie directement sur energie-info.fr.
            </p>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Horaires recommandés pour changer de fournisseur : avant 18h en semaine pour traitement
              rapide le jour même. Préavis : 1 mois maximum pour particulier, vérifier contrat pour
              professionnel.
            </p>
          </div>
        </aside>

        <main className="flex-1">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-background px-6 py-4">
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                avatarUrl ? (
                  <img
                    src={`${avatarUrl}${avatarVersion ? `?v=${avatarVersion}` : ""}`}
                    alt="Avatar"
                    className="h-10 w-10 rounded-full border border-emerald-200 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700">
                    {email ? email.charAt(0).toUpperCase() : "O"}
                  </div>
                )
              ) : null}
              <Link href={routes.marketing.home} className="inline-flex flex-col">
                <span className="text-xs uppercase text-muted-foreground">OptiCash</span>
                <span className="text-xl font-semibold">Pilotage des économies</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <span className="text-xs text-muted-foreground">{email}</span>
              ) : null}
              {isAuthenticated ? (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/abonnement">Abonnement</Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    Se déconnecter
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={routes.app.profile}>Mon profil</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href={routes.app.plan}>Voir mon plan</Link>
                  </Button>
                </>
              ) : null}
            </div>
          </div>
          {children}
        </main>
        {showGlobalChat ? <ExpensesChat summary={{}} isPremium={isPremium} title="Assistant OptiCash" /> : null}
      </div>
    </div>
  );
};
