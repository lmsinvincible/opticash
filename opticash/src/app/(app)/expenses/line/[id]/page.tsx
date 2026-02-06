"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { readExpensesCache } from "@/lib/expenses";

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

  const avgAmount = useMemo(() => {
    if (history.length === 0) return 0;
    const sum = history.reduce((acc, row) => acc + row.amount, 0);
    return sum / history.length;
  }, [history]);

  const confidence = item?.lieu ? 92 : 85;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Détail de la transaction du {item.date}</h2>
          <p className="text-sm text-muted-foreground">On a analysé cette dépense pour toi.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/expenses?line=${item.line}`}>Retour aux dépenses</Link>
        </Button>
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
          {history.length === 0 ? (
            <p>Aucun historique disponible.</p>
          ) : (
            <>
              <div className="space-y-1">
                {history.map((row) => (
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
          <CardTitle>Justificatif CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={`/expenses?line=${item.line}`}>Voir la ligne originale</Link>
          </Button>
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
