import Link from "next/link";
import { Button } from "@/components/ui/button";
import { appName, routes } from "@/lib/config";

export const MarketingHeader = () => {
  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href={routes.marketing.home} className="text-lg font-semibold">
          {appName}
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href={routes.marketing.pricing}>Tarifs</Link>
          <Link href={routes.marketing.privacy}>Confidentialité</Link>
          <Link href={routes.marketing.terms}>CGU</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href={routes.auth.login} className="text-sm text-muted-foreground">
            Se connecter
          </Link>
          <Button asChild>
            <Link href={routes.auth.signup}>Commencer</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};
