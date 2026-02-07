"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { deslugify, readExpensesCache } from "@/lib/expenses";

const subscriptionMatchers = [
  /netflix/i,
  /spotify/i,
  /deezer/i,
  /apple music/i,
  /amazon prime/i,
  /canva/i,
  /linkedin/i,
];

export default function ExpenseMerchantPage() {
  const params = useParams();
  const categorySlug = Array.isArray(params.category) ? params.category[0] : params.category;
  const merchantSlug = Array.isArray(params.merchant) ? params.merchant[0] : params.merchant;
  const categoryName = deslugify(categorySlug ?? "");
  const merchantName = deslugify(merchantSlug ?? "");
  const [query, setQuery] = useState("");
  const [overlayProgress, setOverlayProgress] = useState(0);
  const [isPending, startTransition] = useTransition();
  const items = useMemo(() => readExpensesCache() ?? [], []);
  const overlayActive = isPending;

  useEffect(() => {
    if (!overlayActive) {
      setOverlayProgress(0);
      return;
    }
    const interval = setInterval(() => {
      setOverlayProgress((prev) => (prev >= 90 ? prev : prev + 3));
    }, 180);
    return () => clearInterval(interval);
  }, [overlayActive]);

  const filtered = useMemo(() => {
    const byCategory =
      categorySlug === "frais-bancaires"
        ? items.filter(
            (item) =>
              (item.categorie || "").toLowerCase().includes("frais bancaires") ||
              /frais|cotisation|tenue|commission|agios|package|carte|incident/i.test(item.label)
          )
        : categorySlug === "abonnements"
          ? items.filter(
              (item) =>
                (item.categorie || "").toLowerCase().includes("abonnements") ||
                subscriptionMatchers.some((rx) => rx.test(item.label))
            )
          : items.filter((item) => (item.categorie || "Non classé") === categoryName);

    const merchantLower = merchantName.toLowerCase();
    return byCategory.filter((item) =>
      (item.label || "").toLowerCase().includes(merchantLower)
    );
  }, [categoryName, categorySlug, items, merchantName]);

  const searched = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return filtered;
    return filtered.filter((item) => {
      const hay = `${item.label} ${item.type} ${item.lieu} ${item.date}`.toLowerCase();
      return hay.includes(trimmed);
    });
  }, [filtered, query]);

  const totalSpent = useMemo(
    () => searched.reduce((acc, item) => acc + (item.amount < 0 ? -item.amount : 0), 0),
    [searched]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{merchantName}</h2>
          <p className="text-sm text-muted-foreground">
            {categoryName} · Total {formatCents(Math.round(totalSpent * 100))}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/expenses/category/${categorySlug}`}>Retour catégorie</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/expenses">Retour dépenses</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rechercher dans ce commerçant</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Ex: frais carte, abonnement, paiement..."
            value={query}
            onChange={(event) => startTransition(() => setQuery(event.target.value))}
          />
        </CardContent>
      </Card>

      {overlayActive && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/10 px-4">
          <div className="pointer-events-auto w-full max-w-sm rounded-xl bg-background p-4 text-center shadow-lg">
            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            <p className="text-sm font-medium">Filtrage en cours…</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-emerald-500 transition-[width] duration-300"
                style={{ width: `${overlayProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Détail des dépenses</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Montant</th>
                <th className="py-2 pr-4">Détail IA</th>
              </tr>
            </thead>
            <tbody>
              {searched.map((item) => (
                <tr key={`${item.line}-${item.date}`} className="border-t">
                  <td className="py-3 pr-4">{item.date}</td>
                  <td className="py-3 pr-4">{formatCents(Math.round(item.amount * 100))}</td>
                  <td className="py-3 pr-4">
                    <div className="space-y-1">
                      <div className="text-muted-foreground">{item.type}</div>
                      <div className="text-emerald-700">{item.opportunite}</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {searched.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Aucune dépense trouvée.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
