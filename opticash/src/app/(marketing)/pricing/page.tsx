import { MarketingHeader } from "@/components/layout/marketing-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { pricing } from "@/lib/config";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-16">
        <header className="space-y-4">
          <h1 className="text-3xl font-semibold">Tarifs simples</h1>
          <p className="text-muted-foreground">
            Commencez gratuitement, puis passez en premium pour les analyses avancées.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Gratuit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Analyse de base</p>
              <p>3 actions priorisées</p>
              <p>Import CSV manuel</p>
              <Button variant="outline" className="w-full">Démarrer</Button>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Premium</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="text-2xl font-semibold text-foreground">{pricing.monthly} €/mois</p>
              <p>Analyses illimitées</p>
              <p>Plan complet + coaching IA</p>
              <p>Support prioritaire</p>
              <Button className="w-full">Essayer Premium</Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
