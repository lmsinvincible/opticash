import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UpgradeSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-20">
        <section className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">
            ✓
          </div>
          <h1 className="text-3xl font-semibold md:text-4xl">Merci ! Ton abonnement est actif</h1>
          <p className="text-base text-muted-foreground md:text-lg">
            Tu as maintenant accès illimité : scans sans limite, export PDF, historique et suivi
            mensuel.
          </p>
          <p className="text-lg font-medium text-emerald-700">
            Prêt à récupérer tes premiers centaines d’euros perdus ?
          </p>
          <Button size="lg" asChild className="bg-emerald-600 text-white hover:bg-emerald-600">
            <Link href="/dashboard">Retour au dashboard et faire un nouveau scan</Link>
          </Button>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="border-emerald-200 bg-white/80">
            <CardHeader>
              <CardTitle>Ce que tu débloques maintenant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Scans illimités</p>
              <p>Export PDF de tes plans</p>
              <p>Historique complet des économies</p>
              <p>Suivi mensuel automatique</p>
            </CardContent>
          </Card>
          <Card className="bg-white/80">
            <CardHeader>
              <CardTitle>Rassurance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Annulation à tout moment depuis ton compte.</p>
              <p>Reçu envoyé par email.</p>
              <p>Paiement sécurisé via Stripe.</p>
              <p>Besoin d’aide ? support@opticash.fr</p>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-white/80 p-6 text-center">
          <h2 className="text-xl font-semibold">Ton prochain scan peut détecter 300 à 1 500 €</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Lance un nouveau scan pour débloquer encore plus d’économies.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/plan">Voir mon plan</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/findings">Voir les fuites</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
