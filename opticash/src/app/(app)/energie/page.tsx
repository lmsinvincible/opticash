"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ManualForm = {
  customerType: "particulier" | "professionnel";
  postalCode: string;
  city: string;
  energyType: "electricite" | "gaz" | "les-deux";
  providerName: string;
  offerName: string;
  priceType: "fixe" | "indexe" | "trv";
  contractStart: string;
  contractEnd: string;
  noticePeriod: string;
  exitFees: string;
  pdl: string;
  pce: string;
  optionTarif: "base" | "hp-hc";
  kwhHp: string;
  kwhHc: string;
  powerKva: string;
  yearlyKwh: string;
  priceKwhBase: string;
  priceKwhHp: string;
  priceKwhHc: string;
  monthlySubElec: string;
  gasUsage: string;
  gasClass: string;
  gasZone: string;
  gasKwhPrice: string;
  monthlySubGas: string;
};

const emptyManual: ManualForm = {
  customerType: "particulier",
  postalCode: "",
  city: "",
  energyType: "electricite",
  providerName: "",
  offerName: "",
  priceType: "fixe",
  contractStart: "",
  contractEnd: "",
  noticePeriod: "",
  exitFees: "",
  pdl: "",
  pce: "",
  optionTarif: "base",
  kwhHp: "",
  kwhHc: "",
  powerKva: "",
  yearlyKwh: "",
  priceKwhBase: "",
  priceKwhHp: "",
  priceKwhHc: "",
  monthlySubElec: "",
  gasUsage: "",
  gasClass: "",
  gasZone: "",
  gasKwhPrice: "",
  monthlySubGas: "",
};

export default function EnergiePage() {
  const [manual, setManual] = useState<ManualForm>(emptyManual);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [manualResult, setManualResult] = useState<number | null>(null);

  const isPdf = useMemo(() => (file ? file.type === "application/pdf" : false), [file]);
  const isImage = useMemo(() => (file ? file.type.startsWith("image/") : false), [file]);

  const handleFile = (next: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    if (next && next.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(next));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleAnalyzeUpload = () => {
    if (!file) {
      toast.error("Ajoute une facture d'énergie.");
      return;
    }
    setAnalyzing(true);
    toast.message("Analyse en cours...");
    setTimeout(() => {
      setAnalyzing(false);
      toast.success("Fonctionnalité en cours de développement – comparaison bientôt disponible !");
    }, 3500);
  };

  const handleManualCompare = () => {
    const yearlyKwh = Number(manual.yearlyKwh || 0);
    const priceKwh =
      manual.optionTarif === "hp-hc"
        ? Number(manual.priceKwhHp || 0) + Number(manual.priceKwhHc || 0)
        : Number(manual.priceKwhBase || 0);
    const monthlySub =
      manual.energyType === "gaz"
        ? Number(manual.monthlySubGas || 0)
        : Number(manual.monthlySubElec || 0);
    if (!manual.postalCode || !yearlyKwh || !priceKwh || !monthlySub) {
      toast.error("Merci de remplir au minimum code postal, conso annuelle, prix kWh et abonnement.");
      return;
    }
    const yearly = monthlySub * 12 + yearlyKwh * priceKwh;
    setManualResult(yearly);
    const formatted = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(yearly);
    toast.success(`Ton coût annuel actuel estimé : ${formatted}`);
    const url = `https://comparateur.energie-info.fr/?code_postal=${encodeURIComponent(
      manual.postalCode
    )}&conso=${encodeURIComponent(yearlyKwh)}&option=${encodeURIComponent(manual.optionTarif)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white p-6 shadow-xl">
        <h1 className="text-2xl font-semibold text-foreground">
          Vérifier si je dois changer d&apos;offre (électricité / gaz)
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dépose ta facture (ou renseigne tes infos), et on compare ton contrat aux offres
          disponibles aujourd&apos;hui sur le comparateur officiel du Médiateur national de l&apos;énergie
          (Énergie-Info).
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            "🔍 Comparaison instantanée",
            "💰 Économies estimées",
            "🚀 Étapes claires",
          ].map((item) => (
            <div key={item} className="rounded-lg border bg-white px-4 py-3 text-sm">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Option 1 — Déposer une facture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Ajoute une facture (PDF ou image). Nous préparons la comparaison automatiquement.
            </p>
            <Input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,.heic"
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">{file.name}</div>
                {isImage && previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Prévisualisation facture"
                    className="mt-3 h-40 w-full rounded-md object-cover"
                  />
                ) : isPdf ? (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span>📄 Aperçu PDF disponible après upload.</span>
                  </div>
                ) : (
                  <div className="mt-3 text-xs">Aperçu non disponible pour ce format.</div>
                )}
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground">
              Analyse locale sur ton appareil – supprimée immédiatement après. Aucune donnée stockée
              sans ton accord.
            </div>
            <Button onClick={handleAnalyzeUpload} disabled={analyzing}>
              {analyzing ? "Analyse en cours..." : "Analyser cette facture"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Option 2 — Renseigner manuellement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Type de client</Label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={manual.customerType}
                  onChange={(event) =>
                    setManual((prev) => ({ ...prev, customerType: event.target.value as ManualForm["customerType"] }))
                  }
                >
                  <option value="particulier">Particulier</option>
                  <option value="professionnel">Professionnel</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Énergie à comparer</Label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={manual.energyType}
                  onChange={(event) =>
                    setManual((prev) => ({ ...prev, energyType: event.target.value as ManualForm["energyType"] }))
                  }
                >
                  <option value="electricite">Électricité</option>
                  <option value="gaz">Gaz</option>
                  <option value="les-deux">Les deux</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Code postal</Label>
                <Input
                  value={manual.postalCode}
                  onChange={(event) => setManual((prev) => ({ ...prev, postalCode: event.target.value }))}
                  placeholder="59000"
                />
              </div>
              <div className="grid gap-2">
                <Label>Commune</Label>
                <Input
                  value={manual.city}
                  onChange={(event) => setManual((prev) => ({ ...prev, city: event.target.value }))}
                  placeholder="Lille"
                />
              </div>
              <div className="grid gap-2">
                <Label>Fournisseur actuel</Label>
                <Input
                  value={manual.providerName}
                  onChange={(event) => setManual((prev) => ({ ...prev, providerName: event.target.value }))}
                  placeholder="EDF, Engie, TotalEnergies..."
                />
              </div>
              <div className="grid gap-2">
                <Label>Nom de l&apos;offre</Label>
                <Input
                  value={manual.offerName}
                  onChange={(event) => setManual((prev) => ({ ...prev, offerName: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Type de prix</Label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={manual.priceType}
                  onChange={(event) =>
                    setManual((prev) => ({ ...prev, priceType: event.target.value as ManualForm["priceType"] }))
                  }
                >
                  <option value="fixe">Fixe</option>
                  <option value="indexe">Indexé</option>
                  <option value="trv">TRV</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Engagement / échéance</Label>
                <Input
                  value={manual.contractEnd}
                  onChange={(event) => setManual((prev) => ({ ...prev, contractEnd: event.target.value }))}
                  placeholder="Ex: 12/2026"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>PDL / PRM (électricité)</Label>
                <Input
                  value={manual.pdl}
                  onChange={(event) => setManual((prev) => ({ ...prev, pdl: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>PCE (gaz)</Label>
                <Input
                  value={manual.pce}
                  onChange={(event) => setManual((prev) => ({ ...prev, pce: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Option tarifaire (élec)</Label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={manual.optionTarif}
                  onChange={(event) =>
                    setManual((prev) => ({ ...prev, optionTarif: event.target.value as ManualForm["optionTarif"] }))
                  }
                >
                  <option value="base">Base</option>
                  <option value="hp-hc">HP/HC</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Puissance (kVA)</Label>
                <Input
                  value={manual.powerKva}
                  onChange={(event) => setManual((prev) => ({ ...prev, powerKva: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Conso annuelle (kWh)</Label>
                <Input
                  value={manual.yearlyKwh}
                  onChange={(event) => setManual((prev) => ({ ...prev, yearlyKwh: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Abonnement mensuel élec (€)</Label>
                <Input
                  value={manual.monthlySubElec}
                  onChange={(event) => setManual((prev) => ({ ...prev, monthlySubElec: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Prix kWh base (€)</Label>
                <Input
                  value={manual.priceKwhBase}
                  onChange={(event) => setManual((prev) => ({ ...prev, priceKwhBase: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Prix kWh HP (€)</Label>
                <Input
                  value={manual.priceKwhHp}
                  onChange={(event) => setManual((prev) => ({ ...prev, priceKwhHp: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Prix kWh HC (€)</Label>
                <Input
                  value={manual.priceKwhHc}
                  onChange={(event) => setManual((prev) => ({ ...prev, priceKwhHc: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Usage gaz</Label>
                <Input
                  value={manual.gasUsage}
                  onChange={(event) => setManual((prev) => ({ ...prev, gasUsage: event.target.value }))}
                  placeholder="Cuisson / Eau chaude / Chauffage"
                />
              </div>
              <div className="grid gap-2">
                <Label>Classe de conso gaz</Label>
                <Input
                  value={manual.gasClass}
                  onChange={(event) => setManual((prev) => ({ ...prev, gasClass: event.target.value }))}
                  placeholder="B0 / B1 / B2i"
                />
              </div>
              <div className="grid gap-2">
                <Label>Zone tarifaire gaz</Label>
                <Input
                  value={manual.gasZone}
                  onChange={(event) => setManual((prev) => ({ ...prev, gasZone: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Prix kWh gaz (€)</Label>
                <Input
                  value={manual.gasKwhPrice}
                  onChange={(event) => setManual((prev) => ({ ...prev, gasKwhPrice: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Abonnement mensuel gaz (€)</Label>
                <Input
                  value={manual.monthlySubGas}
                  onChange={(event) => setManual((prev) => ({ ...prev, monthlySubGas: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Préavis / frais de sortie</Label>
                <Input
                  value={manual.exitFees}
                  onChange={(event) => setManual((prev) => ({ ...prev, exitFees: event.target.value }))}
                  placeholder="Ex: 1 mois, 0 €"
                />
              </div>
            </div>

            <Button className="w-full" onClick={handleManualCompare}>
              Comparer mon offre
            </Button>

            {manualResult !== null ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">Rappels importants</div>
                <p className="mt-2">
                  Le marché de l&apos;énergie change plusieurs fois par semaine, voire par jour pour
                  certaines offres. Les prix que tu vois sont à jour à l&apos;instant T.
                </p>
                <p className="mt-2">
                  Horaires recommandés pour changer de fournisseur : avant 18h en semaine pour
                  traitement rapide le jour même. Préavis : 1 mois maximum pour particulier, vérifier
                  contrat pour professionnel.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
