"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { deslugify, groupByMerchant, readExpensesCache } from "@/lib/expenses";

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

  const filtered = useMemo(() => {
    const items = readExpensesCache() ?? [];
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
  }, [categoryName, slug]);
  const merchants = useMemo(() => groupByMerchant(filtered), [filtered]);

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
          <p className="text-sm text-muted-foreground">{filtered.length} lignes</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/expenses">Retour aux dépenses</Link>
        </Button>
      </div>

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
    </div>
  );
}
