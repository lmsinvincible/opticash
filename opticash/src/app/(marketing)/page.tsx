import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { routes, appName } from "@/lib/config";

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-16">
        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Finance proactive</p>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              {appName} récupère l&apos;argent perdu dans vos dépenses quotidiennes.
            </h1>
            <p className="text-lg text-muted-foreground">
              Une IA analyse vos flux financiers ligne par ligne pour révéler les économies cachées et construire
              un plan d&apos;action priorisé.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Button asChild size="lg">
                <Link href={routes.auth.signup}>Commencer gratuitement</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href={routes.app.dashboard}>Voir un aperçu</Link>
              </Button>
            </div>
          </div>
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Gain estimé</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-4xl font-semibold">2 840 €/an</div>
              <p className="text-sm text-muted-foreground">
                Basé sur une analyse rapide de vos frais bancaires, abonnements et impôts.
              </p>
              <div className="rounded-lg bg-muted p-4 text-sm">
                3 actions prioritaires prêtes à être lancées.
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Analyse ligne par ligne",
              body: "Chaque transaction est lue, catégorisée et comparée au benchmark du marché.",
            },
            {
              title: "Plan priorisé",
              body: "Une seule feuille de route avec ROI, effort et risque pour agir vite.",
            },
            {
              title: "IA transparente",
              body: "Explications claires et actionnables, sans jargon financier.",
            },
          ].map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{item.body}</CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
