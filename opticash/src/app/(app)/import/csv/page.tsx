"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";
import { FEATURES } from "@/lib/config";
import { track } from "@/lib/events";

type UploadResponse = {
  upload_id: string;
  columns: string[];
  preview: string[][];
};

type ScanResponse = {
  scan_id: string;
  plan_id: string;
  analyzed_rows?: number;
};

export default function CsvImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState<string[][]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ScanResponse | null>(null);
  const [mapping, setMapping] = useState({
    date: "",
    label: "",
    amount: "",
  });
  const [parsedRowsCount, setParsedRowsCount] = useState(0);
  const [analyzedRows, setAnalyzedRows] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [scanCount, setScanCount] = useState(0);

  const inferMapping = (cols: string[], rows: string[][]) => {
    if (!cols.length) return { date: "", label: "", amount: "" };
    const lower = cols.map((col) => col.toLowerCase());
    const findByHeader = (candidates: string[]) => {
      const idx = lower.findIndex((col) => candidates.some((c) => col.includes(c)));
      return idx >= 0 ? cols[idx] : "";
    };

    const sampleRows = rows.slice(1, 6);
    const scoreColumn = (index: number) => {
      let dateScore = 0;
      let amountScore = 0;
      let labelScore = 0;
      sampleRows.forEach((row) => {
        const value = (row[index] ?? "").trim();
        if (!value) return;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          dateScore += 2;
        }
        if (/^-?\d+[.,]\d{2}$/.test(value) || /^-?\d+$/.test(value)) {
          amountScore += 2;
        }
        if (/[a-zA-Z]/.test(value)) {
          labelScore += 1;
        }
      });
      return { dateScore, amountScore, labelScore };
    };

    const scored = cols.map((_, idx) => ({ idx, ...scoreColumn(idx) }));
    const bestDate = scored.sort((a, b) => b.dateScore - a.dateScore)[0]?.idx ?? 0;
    const bestAmount = scored.sort((a, b) => b.amountScore - a.amountScore)[0]?.idx ?? 1;
    const bestLabel = scored.sort((a, b) => b.labelScore - a.labelScore)[0]?.idx ?? 2;

    const headerDate = findByHeader(["date"]);
    const headerAmount = findByHeader(["amount", "montant", "debit", "débit", "credit", "crédit", "value"]);
    const headerLabel = findByHeader(["label", "libellé", "libelle", "description", "merchant"]);

    return {
      date: headerDate || cols[bestDate] || "",
      amount: headerAmount || cols[bestAmount] || "",
      label: headerLabel || cols[bestLabel] || "",
    };
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id;
        if (!userId) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_premium, is_admin")
          .eq("id", userId)
          .maybeSingle();
        setIsPremium(Boolean(profile?.is_premium));
        setIsAdmin(Boolean(profile?.is_admin));

        const { count } = await supabase
          .from("scans")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId);
        setScanCount(count ?? 0);
      } catch {
        // ignore
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (columns.length === 0) return;
    const inferred = inferMapping(columns, preview);
    setMapping((prev) => ({
      date: prev.date || inferred.date,
      label: prev.label || inferred.label,
      amount: prev.amount || inferred.amount,
    }));
  }, [columns, preview]);

  const handleUpload = async () => {
    if (!file) {
      toast.error("Sélectionne un fichier CSV.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 5MB).");
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error("Session invalide. Merci de vous reconnecter.");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/uploads/csv", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Échec de l'upload.");
      }

      const payload = (await response.json()) as UploadResponse;
      setPreview(payload.preview);
      setColumns(payload.columns);
      setUploadId(payload.upload_id);
      setParsedRowsCount(payload.preview.length);
      setImportResult(null);
      toast.success("CSV importé");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!uploadId) {
      toast.error("Upload introuvable.");
      return;
    }
    let finalMapping = { ...mapping };
    if (!finalMapping.date || !finalMapping.label || !finalMapping.amount) {
      const inferred = inferMapping(columns, preview);
      finalMapping = {
        date: finalMapping.date || inferred.date,
        label: finalMapping.label || inferred.label,
        amount: finalMapping.amount || inferred.amount,
      };
      setMapping(finalMapping);
    }
    if (new Set([finalMapping.date, finalMapping.label, finalMapping.amount]).size !== 3) {
      const fallback = [columns[0], columns[1], columns[2]];
      finalMapping = {
        date: finalMapping.date || fallback[0] || "",
        label: finalMapping.label || fallback[1] || "",
        amount: finalMapping.amount || fallback[2] || "",
      };
      setMapping(finalMapping);
    }
    if (!finalMapping.date || !finalMapping.label || !finalMapping.amount) {
      toast.error("Impossible de détecter automatiquement les colonnes. Choisis-les manuellement.");
      return;
    }
    if (FEATURES.HARD_PAYWALL && !isPremium && !isAdmin && scanCount >= 1) {
      toast.error("Limite gratuite atteinte. Passe en Premium.");
      return;
    }
    setProcessing(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error("Session invalide. Merci de vous reconnecter.");
        return;
      }
      const response = await fetch("/api/scans/from-csv", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          upload_id: uploadId,
          mapping: finalMapping,
          options: { currency: "EUR" },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Échec de l'analyse.");
      }

      const result = (await response.json()) as ScanResponse;
      setImportResult(result);
      setAnalyzedRows(result.analyzed_rows ?? parsedRowsCount);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("Scan CSV terminé");
      localStorage.setItem("opticash:dashboard_refresh", "1");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle>Import réussi ✅ Scan créé.</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{analyzedRows || parsedRowsCount} lignes analysées.</span>
            <Button size="sm" asChild>
              <a href="/plan">Voir mon plan</a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href="/findings">Voir les fuites</a>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a href="/dashboard">Dashboard</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {FEATURES.SOFT_PAYWALL && importResult && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Scanner plus de fichiers → Premium</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Scans illimités + insights avancés + export PDF.</span>
            <Button size="sm" asChild>
              <a href="/upgrade" onClick={() => track("upgrade_clicked", { from: "import" })}>
                Upgrade
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {FEATURES.HARD_PAYWALL && !isPremium && !isAdmin && scanCount >= 1 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Limite gratuite atteinte</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Passage Premium requis pour importer d&apos;autres fichiers.</span>
            <Button size="sm" asChild>
              <a href="/upgrade">Upgrade</a>
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Importer un CSV bancaire</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <span>Pour tester rapidement l’import.</span>
            <Button variant="outline" size="sm" asChild>
              <a href="/templates/opticash-template.csv" download>
                Télécharger un modèle CSV
              </a>
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="csv">Fichier CSV</Label>
            <Input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <Button onClick={handleUpload} disabled={loading}>
            {loading ? "Upload..." : "Uploader"}
          </Button>
        </CardContent>
      </Card>

      {columns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mapping des colonnes (auto-détecté)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              OptiCash détecte automatiquement les colonnes. Tu peux ajuster si besoin.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {["date", "label", "amount"].map((field) => (
                <div key={field} className="space-y-2">
                  <Label>{field}</Label>
                  <select
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={mapping[field as keyof typeof mapping]}
                    onChange={(event) =>
                      setMapping((prev) => ({ ...prev, [field]: event.target.value }))
                    }
                  >
                    <option value="">Sélectionner</option>
                    {columns.map((col) => (
                      <option key={`${field}-${col}`} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const inferred = inferMapping(columns, preview);
                  setMapping(inferred);
                  toast.success("Colonnes détectées automatiquement.");
                }}
              >
                Auto-détecter
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview (20 lignes)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Aperçu sur 20 lignes. L'analyse complète porte sur tout le fichier.
            </p>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {preview[0].map((_, index) => (
                      <th key={`head-${index}`} className="border-b px-2 py-2 text-left">
                        {columns[index] ?? `col_${index + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`cell-${rowIndex}-${cellIndex}`} className="border-b px-2 py-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleContinue} disabled={processing}>
                {processing ? "Analyse..." : "Continuer"}
              </Button>
            </div>
            {importResult && (
              <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                <div className="mb-2 font-medium text-foreground">Import réussi ✅ Scan créé.</div>
                <div className="flex flex-wrap items-center gap-3">
                  <span>{parsedRowsCount} lignes analysées.</span>
                  <Button size="sm" asChild>
                    <a href="/plan">Voir mon plan</a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href="/findings">Voir les fuites</a>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Format CSV attendu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5">
            <li>Date : DD/MM/YYYY ou YYYY-MM-DD</li>
            <li>Montant : -12,34 ou -12.34 (débits négatifs)</li>
            <li>Colonnes minimum : date, libellé, montant</li>
            <li>Astuce : exporte depuis ta banque puis mappe les colonnes ci-dessus.</li>
          </ul>
          <div className="rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
            01/02/2026 ; NETFLIX ; -5,99
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
