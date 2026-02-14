import { MarketingHeader } from "@/components/layout/marketing-header";
import { CguContent } from "@/components/legal/cgu-content";

export default function CguPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-16">
        <h1 className="text-3xl font-semibold">Conditions générales d&apos;utilisation</h1>
        <p className="text-muted-foreground">Dernière mise à jour : 14 février 2026.</p>
        <CguContent />
      </main>
    </div>
  );
}
