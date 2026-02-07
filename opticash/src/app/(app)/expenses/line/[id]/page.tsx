"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { readExpensesCache } from "@/lib/expenses";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Search } from "lucide-react";

type ExpenseRow = {
  line: number;
  date: string;
  label: string;
  amount: number;
  categorie: string;
  lieu: string;
  type: string;
  opportunite: string;
};

const CATEGORY_OPTIONS = [
  "Alimentaire",
  "Frais bancaires",
  "Abonnements",
  "Transport",
  "Logement",
  "Assurances",
  "Santé",
  "Télécom",
  "Éducation",
  "Autres",
];

const normalizeLabel = (label: string) =>
  label
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\d/.-]+/g, "")
    .trim();

export default function ExpenseLinePage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const lineId = Number(id ?? "");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [comment, setComment] = useState("");
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepResult, setDeepResult] = useState<null | {
    analysis: string;
    suggestions: string[];
    next_steps: string[];
  }>(null);
  const [search, setSearch] = useState("");
  const [overlayProgress, setOverlayProgress] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  const overlayActive = deepLoading || isPending;

  useEffect(() => {
    if (!overlayActive) {
      setOverlayProgress(0);
      return;
    }
    const interval = setInterval(() => {
      setOverlayProgress((prev) => (prev >= 90 ? prev : prev + 3));
    }, 200);
    return () => clearInterval(interval);
  }, [overlayActive]);

  const items = useMemo(() => (readExpensesCache() ?? []) as ExpenseRow[], []);
  const item = useMemo(() => items.find((row) => row.line === lineId), [items, lineId]);

  const normalized = useMemo(() => (item ? normalizeLabel(item.label) : ""), [item]);
  const history = useMemo(() => {
    if (!item) return [];
    return items
      .filter((row) => normalizeLabel(row.label) === normalized)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 12);
  }, [items, item, normalized]);

  const filteredHistory = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return history;
    return history.filter((row) => {
      const hay = `${row.label} ${row.categorie} ${row.lieu} ${row.type} ${row.date}`.toLowerCase();
      return hay.includes(trimmed);
    });
  }, [history, search]);

  const avgAmount = useMemo(() => {
    if (filteredHistory.length === 0) return 0;
    const sum = filteredHistory.reduce((acc, row) => acc + row.amount, 0);
    return sum / filteredHistory.length;
  }, [filteredHistory]);

  const totalFiltered = useMemo(
    () =>
      filteredHistory.reduce((acc, row) => acc + (row.amount < 0 ? -row.amount : 0), 0),
    [filteredHistory]
  );

  const confidence = item?.lieu ? 92 : 85;
  const totalLines = items.length;

  if (!item || Number.isNaN(lineId)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction introuvable</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Impossible de retrouver cette ligne. Retourne au détail des dépenses.
          <div className="mt-3">
            <Button asChild>
              <Link href="/expenses">Retour aux dépenses</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const explanation =
    item.categorie && item.label
      ? `L’IA classe cette dépense en "${item.categorie}" car le libellé "${item.label}" correspond à un achat de ce type et le montant (${formatCents(
          Math.round(item.amount * 100)
        )}) est cohérent.`
      : "L’IA s’appuie sur le libellé et le montant pour estimer la catégorie.";

  const opportunity =
    item.opportunite && item.opportunite !== "—"
      ? item.opportunite
      : "Aucune opportunité majeure détectée pour cette ligne.";

  const handleFeedback = () => {
    const payload = {
      line: item.line,
      label: item.label,
      currentCategory: item.categorie,
      newCategory,
      comment,
      createdAt: new Date().toISOString(),
    };
    const existing = JSON.parse(localStorage.getItem("opticash:expense-feedback") || "[]");
    existing.push(payload);
    localStorage.setItem("opticash:expense-feedback", JSON.stringify(existing));
    setFeedbackSent(true);
  };

  const handleDeepAnalysis = async () => {
    if (!item) return;
    setDeepLoading(true);
    try {
      const response = await fetch("/api/ai/expense-detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item,
          history,
          avgAmount,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Impossible d’analyser cette ligne.");
      }
      const payload = (await response.json()) as {
        analysis: string;
        suggestions: string[];
        next_steps: string[];
      };
      setDeepResult(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur IA";
      setDeepResult({
        analysis: message,
        suggestions: [],
        next_steps: [],
      });
    } finally {
      setDeepLoading(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      const { PDFDocument, StandardFonts } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const { height } = page.getSize();
      let y = height - 50;

      const draw = (text: string, size = 12) => {
        page.drawText(text, { x: 40, y, size, font });
        y -= size + 6;
      };

      draw(`OptiCash — Détail transaction ligne #${item.line}`, 16);
      draw(`Date : ${item.date}`);
      draw(`Libellé : ${item.label}`);
      draw(`Catégorie : ${item.categorie}`);
      draw(`Total filtré : ${formatCents(Math.round(totalFiltered * 100))}`);
      y -= 8;
      draw("Historique filtré :", 13);
      filteredHistory.forEach((row) => {
        if (y < 60) return;
        draw(`${row.date} | ${row.label} | ${formatCents(Math.round(row.amount * 100))}`, 10);
      });

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "opticash-transaction.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur PDF";
      toast.error(message);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    const nextMessages = [...chatMessages, { role: "user", content: chatInput.trim() }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error("Session invalide. Merci de vous reconnecter.");
        return;
      }
      const summary = {
        line: item.line,
        date: item.date,
        label: item.label,
        category: item.categorie,
        totalFiltered,
        count: filteredHistory.length,
      };
      const response = await fetch("/api/ai/expenses-chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: nextMessages, summary }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Impossible de contacter l’IA.");
      }
      const payload = (await response.json()) as { reply: string };
      setChatMessages((prev) => [...prev, { role: "assistant", content: payload.reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur IA";
      toast.error(message);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {overlayActive && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/10 px-4">
          <div className="pointer-events-auto w-full max-w-sm rounded-xl bg-background p-4 text-center shadow-lg">
            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            <p className="text-sm font-medium">Chargement des détails…</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-emerald-500 transition-[width] duration-300"
                style={{ width: `${overlayProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}
      <nav className="text-xs text-muted-foreground">
        <Link className="hover:text-foreground" href="/">
          Accueil
        </Link>{" "}
        &gt;{" "}
        <Link className="hover:text-foreground" href="/expenses">
          Dépenses
        </Link>{" "}
        &gt; {item.categorie} &gt; {item.lieu || "Transaction"} &gt; {item.date}
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Détail de la transaction du {item.date}</h2>
          <p className="text-sm text-muted-foreground">On a analysé cette dépense pour toi.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/expenses?line=${item.line}`}>Retour aux dépenses</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          Ligne #{item.line}
          {totalLines > 0 ? ` / ${totalLines}` : ""} du CSV
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Libellé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Libellé brut</p>
          <p className="text-lg font-semibold">{item.label}</p>
          <p className="text-sm text-muted-foreground">Libellé normalisé</p>
          <p className="text-base">{item.lieu || item.label}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Merchant & confiance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant="outline">{item.lieu || "Lieu non détecté"}</Badge>
          <Badge className="bg-emerald-600 text-white">{confidence}% confiance IA</Badge>
          <span className="text-sm text-muted-foreground">
            Libellé typique détecté pour ce marchand.
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catégorie & explication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Catégorie : <span className="font-medium text-foreground">{item.categorie}</span>
          </p>
          <p>{explanation}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Type de dépense</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="secondary">{item.type}</Badge>
          <span>Montant : {formatCents(Math.round(item.amount * 100))}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des mêmes paiements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full rounded-md border py-2 pl-9 pr-3 text-sm"
                placeholder="Rechercher dans l’historique..."
                value={search}
              onChange={(event) => startTransition(() => setSearch(event.target.value))}
            />
            </div>
            <div className="text-sm text-muted-foreground">
              Total filtré :{" "}
              <span className="font-medium text-foreground">
                {formatCents(Math.round(totalFiltered * 100))}
              </span>
            </div>
          </div>
          {filteredHistory.length === 0 ? (
            <p>Aucun historique disponible.</p>
          ) : (
            <>
              <div className="space-y-1">
                {filteredHistory.map((row) => (
                  <div key={`${row.line}-${row.date}`} className="flex justify-between">
                    <span>
                      {row.date} · {row.label}
                    </span>
                    <span>{formatCents(Math.round(row.amount * 100))}</span>
                  </div>
                ))}
              </div>
              <p>
                Moyenne : <span className="font-medium text-foreground">{formatCents(Math.round(avgAmount * 100))}</span>
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opportunité d’économie</CardTitle>
        </CardHeader>
        <CardContent className="rounded-lg bg-emerald-50/60 p-4 text-sm text-emerald-900">
          <p>{opportunity}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analyse approfondie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Besoin d’un niveau de détail supplémentaire ?</p>
          <Button size="sm" onClick={handleDeepAnalysis} disabled={deepLoading}>
            {deepLoading ? "Analyse en cours..." : "Lancer l’analyse approfondie"}
          </Button>
          {deepLoading && (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-2 w-1/2 animate-pulse rounded-full bg-emerald-500" />
              </div>
              <p>Analyse en cours…</p>
            </div>
          )}
          {deepResult && (
            <div className="space-y-3">
              <p className="text-foreground">{deepResult.analysis}</p>
              {deepResult.suggestions.length > 0 && (
                <div>
                  <p className="font-medium text-foreground">Suggestions</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {deepResult.suggestions.map((item, index) => (
                      <li key={`suggestion-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {deepResult.next_steps.length > 0 && (
                <div>
                  <p className="font-medium text-foreground">Prochaines étapes</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    {deepResult.next_steps.map((step, index) => (
                      <li key={`next-${index}`}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Justificatif CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/expenses?line=${item.line}`}>Voir la ligne originale</Link>
            </Button>
            <Button variant="outline" onClick={handleExportPdf}>
              Exporter en PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assistant dépenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm text-muted-foreground">
            {chatMessages.length === 0 ? (
              <p>Pose une question sur cette dépense, je t’aide à résumer.</p>
            ) : (
              chatMessages.map((msg, index) => (
                <div
                  key={`${msg.role}-${index}`}
                  className={
                    msg.role === "user"
                      ? "rounded-md bg-muted/40 p-2 text-foreground"
                      : "rounded-md bg-emerald-50/60 p-2 text-emerald-900"
                  }
                >
                  {msg.content}
                </div>
              ))
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="flex-1 rounded-md border px-3 py-2 text-sm"
              placeholder="Ex: Résume mes dépenses Carrefour ce mois-ci"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
            />
            <Button size="sm" onClick={handleChatSend} disabled={chatLoading}>
              {chatLoading ? "Analyse..." : "Envoyer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cette catégorisation est incorrecte ?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
          >
            <option value="">Choisir une catégorie</option>
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm"
            rows={3}
            placeholder="Commentaire optionnel"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <Button onClick={handleFeedback} disabled={!newCategory || feedbackSent}>
            {feedbackSent ? "Merci, feedback enregistré" : "Envoyer"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
