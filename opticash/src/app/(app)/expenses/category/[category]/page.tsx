"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { deslugify, groupByMerchant, readExpensesCache } from "@/lib/expenses";
import { ExpensesChat } from "@/components/expenses/expenses-chat";

const subscriptionMatchers = [
  /netflix/i,
  /spotify/i,
  /deezer/i,
  /apple music/i,
  /amazon prime/i,
  /canva/i,
  /linkedin/i,
];

export default function ExpenseCategoryPage() {
  const params = useParams();
  const slug = Array.isArray(params.category) ? params.category[0] : params.category;
  const categoryName = deslugify(slug ?? "");
  const [query, setQuery] = useState("");
  const [overlayProgress, setOverlayProgress] = useState(0);
  const [isPending, startTransition] = useTransition();
  const items = useMemo(() => readExpensesCache() ?? [], []);
  const overlayActive = isPending;

  useEffect(() => {
    if (!overlayActive) return;
    const interval = setInterval(() => {
      setOverlayProgress((prev) => (prev >= 90 ? prev : prev + 3));
    }, 180);
    return () => clearInterval(interval);
  }, [overlayActive]);

  const filtered = useMemo(() => {
    if (slug === "frais-bancaires") {
      return items.filter(
        (item) =>
          (item.categorie || "").toLowerCase().includes("frais bancaires") ||
          /frais|cotisation|tenue|commission|agios|package|carte|incident/i.test(item.label)
      );
    }
    if (slug === "abonnements") {
      return items.filter(
        (item) =>
          (item.categorie || "").toLowerCase().includes("abonnements") ||
          subscriptionMatchers.some((rx) => rx.test(item.label))
      );
    }
    return items.filter((item) => (item.categorie || "Non classé") === categoryName);
  }, [categoryName, items, slug]);
  const searched = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return filtered;
    return filtered.filter((item) => {
      const hay = `${item.label} ${item.categorie} ${item.lieu} ${item.type} ${item.date}`.toLowerCase();
      return hay.includes(trimmed);
    });
  }, [filtered, query]);

  const merchants = useMemo(() => groupByMerchant(searched), [searched]);
  const totalSpent = useMemo(
    () => searched.reduce((acc, item) => acc + (item.amount < 0 ? -item.amount : 0), 0),
    [searched]
  );
  const summary = useMemo(
    () => ({
      count: searched.length,
      totalSpent,
      category: categoryName,
      query,
      topMerchants: merchants.slice(0, 5).map((merchant) => ({
        name: merchant.merchant,
        total: merchant.total,
      })),
    }),
    [searched.length, totalSpent, categoryName, query, merchants]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">
            {slug === "frais-bancaires"
              ? "Frais bancaires"
              : slug === "abonnements"
                ? "Abonnements"
                : categoryName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {searched.length} lignes · Total {formatCents(Math.round(totalSpent * 100))}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/expenses">Retour aux dépenses</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rechercher dans cette catégorie</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Ex: Carrefour, boulangerie, frais carte..."
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
          <CardTitle>Détail par commerçant</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {merchants.map((merchant) => (
            <Link
              key={merchant.slug}
              href={`/expenses/category/${slug}/${merchant.slug}`}
              className="rounded-lg border px-4 py-3 text-sm transition hover:border-emerald-300 hover:bg-emerald-50/50"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{merchant.merchant}</span>
                <span className="text-muted-foreground">{merchant.count} lignes</span>
              </div>
              <div className="mt-2 text-sm text-emerald-700">
                Total: {formatCents(Math.round(merchant.total * 100))}
              </div>
            </Link>
          ))}
          {merchants.length === 0 && (
            <div className="text-sm text-muted-foreground">Aucune dépense dans cette catégorie.</div>
          )}
        </CardContent>
      </Card>

      <ExpensesChat summary={summary} />
    </div>
  );
}
