import { MarketingHeader } from "@/components/layout/marketing-header";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-16">
        <h1 className="text-3xl font-semibold">Conditions générales</h1>
        <p className="text-muted-foreground">
          OptiCash fournit des recommandations financières non personnalisées et ne remplace pas un conseil fiscal.
        </p>
        <div className="rounded-lg border bg-muted/40 p-6 text-sm text-muted-foreground">
          Cette page sera complétée avec les CGU définitives avant lancement.
        </div>
      </main>
    </div>
  );
}
