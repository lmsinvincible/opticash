import { MarketingHeader } from "@/components/layout/marketing-header";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-16">
        <h1 className="text-3xl font-semibold">Politique de confidentialité</h1>
        <p className="text-muted-foreground">
          OptiCash applique une minimisation des données et conserve uniquement ce qui est nécessaire à l'analyse.
        </p>
        <div className="rounded-lg border bg-muted/40 p-6 text-sm text-muted-foreground">
          Cette page sera enrichie avec les mentions RGPD finales avant lancement.
        </div>
      </main>
    </div>
  );
}
