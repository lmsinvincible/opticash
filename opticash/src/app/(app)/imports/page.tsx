"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type UploadItem = {
  id: string;
  kind: string;
  original_name: string | null;
  created_at: string;
  status: string;
  columns: string[];
  preview: string[][];
  download_url: string | null;
};

type UploadResponse = {
  limit: number;
  total: number;
  items: UploadItem[];
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

const toCsv = (columns: string[], rows: string[][]) => {
  const safe = (cell: string) => `"${String(cell).replace(/"/g, '""')}"`;
  const header = columns.length ? columns.map(safe).join(",") : "";
  const body = rows.map((row) => row.map(safe).join(",")).join("\n");
  return [header, body].filter(Boolean).join("\n");
};

export default function ImportsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UploadResponse | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [tab, setTab] = useState<"opticash" | "factures" | "impots">("opticash");

  useEffect(() => {
    const load = async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        toast.error("Session invalide.");
        setLoading(false);
        return;
      }
      const response = await fetch("/api/uploads/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        toast.error("Impossible de charger l'historique.");
        setLoading(false);
        return;
      }
      const payload = (await response.json()) as UploadResponse;
      setData(payload);
      setLoading(false);
    };
    load();
  }, []);

  const items = useMemo(() => data?.items ?? [], [data]);
  const opticashItems = useMemo(
    () => items.filter((item) => item.kind === "csv"),
    [items]
  );
  const factureItems = useMemo(
    () => items.filter((item) => item.kind === "facture"),
    [items]
  );
  const impotsItems = useMemo(
    () => items.filter((item) => item.kind === "impots"),
    [items]
  );

  const handleDownloadSummary = (item: UploadItem) => {
    const csv = toCsv(item.columns ?? [], item.preview ?? []);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume-${item.original_name ?? "import"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (item: UploadItem) => {
    if (!confirm("Supprimer cet import ?")) return;
    setDeleting(item.id);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        toast.error("Session invalide.");
        return;
      }
      const response = await fetch("/api/uploads/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: item.id }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Suppression impossible.");
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((upload) => upload.id !== item.id),
              total: Math.max(0, prev.total - 1),
            }
          : prev
      );
      toast.success("Import supprimé.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur suppression.";
      toast.error(message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Historique des imports</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {loading ? (
            <div>Chargement...</div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div>
                {items.length} import(s) affichés sur un maximum de {data?.limit ?? 0}.
              </div>
              <div>({data?.total ?? 0} au total)</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Derniers imports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={tab === "opticash" ? "default" : "outline"}
              onClick={() => setTab("opticash")}
            >
              Imports OptiCash
            </Button>
            <Button
              size="sm"
              variant={tab === "factures" ? "default" : "outline"}
              onClick={() => setTab("factures")}
            >
              Imports factures
            </Button>
            <Button
              size="sm"
              variant={tab === "impots" ? "default" : "outline"}
              onClick={() => setTab("impots")}
            >
              Impôts Boost
            </Button>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">Chargement...</div>
          ) : tab === "opticash" && opticashItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucun import enregistré.</div>
          ) : tab === "factures" && factureItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucune facture enregistrée.</div>
          ) : tab === "impots" && impotsItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucun Impôts Boost enregistré.</div>
          ) : (
            <div className="space-y-4">
              {(tab === "opticash"
                ? opticashItems
                : tab === "factures"
                ? factureItems
                : impotsItems
              ).map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-medium">
                      {item.original_name ??
                        (item.kind === "facture"
                          ? "Facture énergie"
                          : item.kind === "impots"
                          ? "Impôts Boost"
                          : "Import CSV")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(item.created_at)} • {item.status}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.preview?.length ?? 0} lignes de résumé
                    </div>
                    {item.kind === "facture" && item.preview?.length ? (
                      <div className="text-xs text-muted-foreground">
                        {item.preview[0]?.[0]} : {item.preview[0]?.[1]}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadSummary(item)}
                    >
                      Télécharger résumé
                    </Button>
                    <Button
                      size="sm"
                      disabled={!item.download_url}
                      onClick={() => {
                        if (!item.download_url) return;
                        window.location.href = item.download_url;
                      }}
                    >
                      Télécharger fichier
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(item)}
                      disabled={deleting === item.id}
                    >
                      {deleting === item.id ? "Suppression..." : "Supprimer"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
