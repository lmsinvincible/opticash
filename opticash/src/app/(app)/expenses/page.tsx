"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { formatCents } from "@/lib/money";
import { routes } from "@/lib/config";
import { toast } from "sonner";

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

export default function ExpensesPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ExpenseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const session = await supabase.auth.getSession();
        const userId = session.data.session?.user?.id;
        if (!userId) {
          setError("Connecte-toi pour accéder au détail des dépenses.");
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_premium, is_admin")
          .eq("id", userId)
          .maybeSingle();
        if (!mounted) return;
        setIsPremium(Boolean(profile?.is_premium));
        setIsAdmin(Boolean(profile?.is_admin));
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!isPremium && !isAdmin) return;
      try {
        setLoading(true);
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) {
          setError("Session invalide. Merci de vous reconnecter.");
          return;
        }
        const response = await fetch("/api/expenses/analyze", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.status === 402) {
          setError("Accès Premium requis.");
          return;
        }
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Impossible de charger les dépenses.");
        }
        const payload = (await response.json()) as { items: ExpenseRow[] };
        setItems(payload.items ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [isPremium, isAdmin]);

  const opportunities = useMemo(
    () => items.filter((item) => item.opportunite && item.opportunite !== "—").length,
    [items]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="h-28 animate-pulse" />
        <Card className="h-64 animate-pulse" />
      </div>
    );
  }

  if (!isPremium && !isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accès Premium requis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Le détail ligne par ligne est réservé aux comptes Premium.</p>
          <Button asChild>
            <Link href="/upgrade">Passer Premium</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Impossible de charger les dépenses</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Dépenses détaillées</h2>
          <p className="text-sm text-muted-foreground">
            500 lignes max · {opportunities} opportunités détectées
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={routes.app.plan}>Retour au plan</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tableau ligne par ligne</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Libellé</th>
                <th className="py-2 pr-4">Montant</th>
                <th className="py-2 pr-4">Catégorie</th>
                <th className="py-2 pr-4">Détail IA</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.line}-${item.label}`} className="border-t">
                  <td className="py-3 pr-4 text-muted-foreground">{item.line}</td>
                  <td className="py-3 pr-4">{item.date}</td>
                  <td className="py-3 pr-4">{item.label}</td>
                  <td className="py-3 pr-4">{formatCents(Math.round(item.amount * 100))}</td>
                  <td className="py-3 pr-4">{item.categorie}</td>
                  <td className="py-3 pr-4">
                    <div className="space-y-1">
                      <div>{item.lieu}</div>
                      <div className="text-muted-foreground">{item.type}</div>
                      <div className="text-emerald-700">{item.opportunite}</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Aucune ligne détectée. Refais un scan CSV.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
