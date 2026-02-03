import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketingHeader } from "@/components/layout/marketing-header";

export default function UpgradeCancelPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Paiement annulé</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Tu peux reprendre quand tu veux. Ton compte reste gratuit.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/upgrade">Revenir à Premium</Link>
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
