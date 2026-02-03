import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketingHeader } from "@/components/layout/marketing-header";

export default function UpgradeSuccessPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Merci ! Premium est activé ✅</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Ton abonnement est actif. Tu peux exporter ton plan et lancer des scans illimités.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/plan">Voir mon plan</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/findings">Voir les fuites</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
