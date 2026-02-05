"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { deslugify, readExpensesCache } from "@/lib/expenses";

export default function ExpenseMerchantPage() {
  const params = useParams();
  const categorySlug = Array.isArray(params.category) ? params.category[0] : params.category;
  const merchantSlug = Array.isArray(params.merchant) ? params.merchant[0] : params.merchant;
  const categoryName = deslugify(categorySlug ?? "");
  const merchantName = deslugify(merchantSlug ?? "");

  const items = readExpensesCache() ?? [];
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (item.categorie || "Non classé") === categoryName && (item.label || "") === merchantName
      ),
    [items, categoryName, merchantName]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{merchantName}</h2>
          <p className="text-sm text-muted-foreground">{categoryName}</p>
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
              {filtered.map((item) => (
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
          {filtered.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Aucune dépense trouvée.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
