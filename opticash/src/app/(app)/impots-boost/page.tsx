"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ExpensesChat } from "@/components/expenses/expenses-chat";

type Mode = "upload" | "manual" | "both";

type ManualForm = {
  salary: string;
  km: string;
  children: string;
  donations: string;
  notes: string;
};

const emptyManual: ManualForm = {
  salary: "",
  km: "",
  children: "",
  donations: "",
  notes: "",
};

type ActionItem = {
  action_title: string;
  gain_estimated_yearly_cents: number;
  action_steps: string[];
  proof: string;
  reasoning: string[];
  priority_score: number;
};

export default function ImpotsBoostPage() {
  const [mode, setMode] = useState<Mode>("both");
  const [manual, setManual] = useState<ManualForm>(emptyManual);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ActionItem[]>([]);
  const [chatContext, setChatContext] = useState<{
    salary: number;
    km: number;
    children: number;
    donations: number;
    totalGain: number;
  } | null>(null);

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

  const startProgress = () => {
    setProgress(5);
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 85 ? prev : prev + 5));
    }, 400);
    return interval;
  };

  const handleAnalyze = async () => {
    if (mode !== "manual" && !file) {
      toast.error("Ajoute un avis d’impôt PDF ou image.");
      return;
    }
    if (mode !== "upload" && !manual.salary && !manual.km && !manual.donations) {
      toast.error("Renseigne au moins salaire, km ou dons.");
      return;
    }

    setLoading(true);
    const timer = startProgress();

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        toast.error("Session invalide.");
        return;
      }

      const salary = Number(manual.salary || (mode !== "manual" ? 2600 : 0));
      const km = Number(manual.km || (mode !== "manual" ? 12000 : 0));
      const children = Number(manual.children || 0);
      const donations = Number(manual.donations || (mode !== "manual" ? 200 : 0));
      const notes = manual.notes;

      const response = await fetch("/api/ai/tax-actions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          salary,
          km,
          children,
          donations,
          notes,
          ocrText: mode === "upload" ? "SIMULATION PDF" : undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Analyse impossible.");
      }

      const payload = (await response.json()) as { items: ActionItem[] };
      setResults(payload.items ?? []);
      const totalGain = (payload.items ?? []).reduce(
        (acc, item) => acc + Number(item.gain_estimated_yearly_cents || 0),
        0
      );
      const summaryItems = (payload.items ?? []).map((item) => ({
        title: item.action_title,
        gain: Math.round(Number(item.gain_estimated_yearly_cents || 0) / 100),
      }));
      setChatContext({
        salary,
        km,
        children,
        donations,
        totalGain: Math.round(totalGain / 100),
      });
      try {
        await fetch("/api/uploads/impots", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: summaryItems,
            totalGain: Math.round(totalGain / 100),
          }),
        });
      } catch {
        // ignore history save failure
      }
      setProgress(100);
      toast.success("Analyse terminée.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur analyse.";
      toast.error(message);
    } finally {
      clearInterval(timer);
      setLoading(false);
      setTimeout(() => setProgress(0), 600);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <Card className="border-emerald-200 bg-gradient-to-b from-emerald-50/60 to-white shadow-lg">
        <CardHeader>
          <CardTitle>Optimise tes impôts et gagne plus</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Choisis comment analyser ton dossier : PDF, formulaire rapide, ou les deux.
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { id: "upload", title: "Uploader mon avis d’impôt PDF", desc: "Upload + preview visuel." },
          { id: "manual", title: "Renseigner mes infos manuellement", desc: "Saisie rapide." },
          { id: "both", title: "Faire les deux (recommandé)", desc: "Plus précis." },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setMode(item.id as Mode)}
            className={`rounded-xl border p-4 text-left transition ${
              mode === item.id ? "border-emerald-500 bg-emerald-50" : "bg-white"
            }`}
          >
            <div className="text-sm font-semibold">{item.title}</div>
            <div className="text-xs text-muted-foreground">{item.desc}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {(mode === "upload" || mode === "both") && (
          <Card>
            <CardHeader>
              <CardTitle>Upload avis d’impôt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.heic"
                onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                  <div className="font-medium text-foreground">{file.name}</div>
                  {isImage && previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Aperçu avis d'impôt"
                      className="mt-3 h-40 w-full rounded-md object-cover"
                    />
                  ) : (
                    <div className="mt-3 text-xs text-muted-foreground">Aperçu PDF après upload.</div>
                  )}
                </div>
              ) : null}
              <div className="text-xs text-muted-foreground">
                Analyse locale sur ton appareil – supprimée immédiatement après. Aucune donnée
                stockée sans ton accord.
              </div>
            </CardContent>
          </Card>
        )}

        {(mode === "manual" || mode === "both") && (
          <Card>
            <CardHeader>
              <CardTitle>Infos manuelles</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label>Salaire mensuel net moyen (€)</Label>
                <Input
                  value={manual.salary}
                  onChange={(event) => setManual((prev) => ({ ...prev, salary: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Km domicile-travail / an</Label>
                <Input
                  value={manual.km}
                  onChange={(event) => setManual((prev) => ({ ...prev, km: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Nombre d’enfants à charge</Label>
                <Input
                  value={manual.children}
                  onChange={(event) => setManual((prev) => ({ ...prev, children: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Dons approx (€)</Label>
                <Input
                  value={manual.donations}
                  onChange={(event) => setManual((prev) => ({ ...prev, donations: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Input
                  value={manual.notes}
                  onChange={(event) => setManual((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="text-sm font-medium">Analyse en cours…</div>
            <Progress value={progress} className="mt-3" />
          </div>
        )}
        <Button onClick={handleAnalyze} disabled={loading}>
          {loading ? "Analyse en cours..." : "Lancer l’analyse Impôts Boost"}
        </Button>
      </div>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Résultats Impôts Boost</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-emerald-50/60 p-4 text-sm">
              <div className="text-emerald-900">
                Gain total estimé :{" "}
                <span className="font-semibold">
                  {(results.reduce((acc, item) => acc + Number(item.gain_estimated_yearly_cents || 0), 0) / 100).toFixed(0)} € / an
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  const prompt = [
                    "Salut ! Je peux t’aider à optimiser tes impôts.",
                    `Salaire mensuel estimé : ${chatContext?.salary ?? 0} €`,
                    `Km domicile-travail : ${chatContext?.km ?? 0} km/an`,
                    `Dons estimés : ${chatContext?.donations ?? 0} €`,
                    `Enfants à charge : ${chatContext?.children ?? 0}`,
                    `Gain total estimé : ${chatContext?.totalGain ?? 0} € / an`,
                    "Pose-moi une question, par exemple : “Quelle action est la plus rentable ?”",
                  ]
                    .filter(Boolean)
                    .join("\n");
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("opticash:open-chat", { detail: { prompt } })
                    );
                  }
                }}
              >
                Ouvrir Chat IA
              </Button>
            </div>
            {results.map((item) => (
              <div key={item.action_title} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{item.action_title}</div>
                  <div className="text-sm font-semibold text-emerald-700">
                    {(item.gain_estimated_yearly_cents / 100).toFixed(0)} € / an
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">Preuve : {item.proof}</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {item.reasoning?.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
                <div className="mt-2 text-xs font-medium">Étapes :</div>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                  {item.action_steps?.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ExpensesChat
        summary={{
          type: "tax",
          page: "/impots-boost",
          context: chatContext ?? {},
          note: "Assistant impôts pour guider les démarches et optimiser.",
        }}
        title="Assistant impôts"
      />
    </div>
  );
}
