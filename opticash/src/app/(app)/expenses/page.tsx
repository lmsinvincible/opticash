"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { formatCents } from "@/lib/money";
import { routes } from "@/lib/config";
import { groupByCategory, writeExpensesCache } from "@/lib/expenses";
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
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [query, setQuery] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const lineParam = searchParams.get("line");

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
        const payload = (await response.json()) as { items: ExpenseRow[]; count?: number };
        setItems(payload.items ?? []);
        setAnalyzedCount(payload.count ?? (payload.items?.length ?? 0));
        writeExpensesCache(payload.items ?? []);
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

  const visibleItems = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return filteredItems;
    return filteredItems.filter((item) => {
      const hay = [
        item.label,
        item.categorie,
        item.lieu,
        item.type,
        item.opportunite,
        item.date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(trimmed);
    });
  }, [filteredItems, query]);

  const opportunities = useMemo(
    () => visibleItems.filter((item) => item.opportunite && item.opportunite !== "—").length,
    [visibleItems]
  );
  const categories = useMemo(() => groupByCategory(items), [items]);
  const totalSpent = useMemo(
    () =>
      visibleItems.reduce((acc, item) => acc + (item.amount < 0 ? -item.amount : 0), 0),
    [visibleItems]
  );
  const netTotal = useMemo(
    () => visibleItems.reduce((acc, item) => acc + item.amount, 0),
    [visibleItems]
  );

  const summary = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    const merchantTotals: Record<string, number> = {};
    visibleItems.forEach((item) => {
      if (item.amount >= 0) return;
      const cat = item.categorie || "Non classé";
      categoryTotals[cat] = (categoryTotals[cat] ?? 0) + Math.abs(item.amount);
      const merchant = item.label || "Inconnu";
      merchantTotals[merchant] = (merchantTotals[merchant] ?? 0) + Math.abs(item.amount);
    });
    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));
    const topMerchants = Object.entries(merchantTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));
    return {
      count: visibleItems.length,
      totalSpent,
      netTotal,
      topCategories,
      topMerchants,
      query,
      category: categoryParam ?? "all",
    };
  }, [visibleItems, totalSpent, netTotal, query, categoryParam]);

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

      draw("OptiCash — Résumé des dépenses filtrées", 16);
      draw(`Lignes affichées : ${summary.count}`);
      draw(`Total dépensé : ${formatCents(Math.round(summary.totalSpent * 100))}`);
      draw(`Net : ${formatCents(Math.round(summary.netTotal * 100))}`);
      draw(
        `Filtre : ${summary.query ? `"${summary.query}"` : "aucun"} / catégorie: ${summary.category}`
      );
      y -= 6;
      draw("Top catégories:", 13);
      summary.topCategories.forEach((c) =>
        draw(`- ${c.name} : ${formatCents(Math.round(c.total * 100))}`, 11)
      );
      y -= 4;
      draw("Top commerçants:", 13);
      summary.topMerchants.forEach((m) =>
        draw(`- ${m.name} : ${formatCents(Math.round(m.total * 100))}`, 11)
      );

      y -= 8;
      draw("Lignes (100 max) :", 13);
      visibleItems.slice(0, 100).forEach((item) => {
        if (y < 60) return;
        draw(
          `${item.date} | ${item.label} | ${formatCents(Math.round(item.amount * 100))} | ${item.categorie}`,
          10
        );
      });

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "opticash-depenses.pdf";
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
  const filteredItems = useMemo(() => {
    if (!categoryParam) return items;
    if (categoryParam === "frais-bancaires") {
      return items.filter(
        (item) =>
          (item.categorie || "").toLowerCase().includes("frais bancaires") ||
          /frais|cotisation|tenue|commission|agios|package|carte|incident/i.test(item.label)
      );
    }
    if (categoryParam === "abonnements") {
      return items.filter(
        (item) =>
          (item.categorie || "").toLowerCase().includes("abonnements") ||
          /netflix|spotify|deezer|apple music|amazon prime|canva|linkedin/i.test(item.label)
      );
    }
    return items.filter(
      (item) => (item.categorie || "Non classé") === categoryParam.replace(/-/g, " ")
    );
  }, [items, categoryParam]);

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
            {analyzedCount} lignes analysées · 500 lignes max · {visibleItems.length} affichées ·{" "}
            {opportunities} opportunités détectées
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={routes.app.plan}>Retour au plan</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rechercher une dépense</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Rechercher un libellé, un lieu, une catégorie..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="text-sm text-muted-foreground">
              Total dépensé :{" "}
              <span className="font-medium text-foreground">
                {formatCents(Math.round(totalSpent * 100))}
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleExportPdf}>
              Exporter le résumé PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catégories détectées</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/expenses?category=${category.slug}`}
              className="rounded-lg border px-4 py-3 text-sm transition hover:border-emerald-300 hover:bg-emerald-50/50"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{category.category}</span>
                <span className="text-muted-foreground">{category.count} lignes</span>
              </div>
              <div className="mt-2 text-sm text-emerald-700">
                Total: {formatCents(Math.round(category.total * 100))}
              </div>
            </Link>
          ))}
          {categories.length === 0 && (
            <div className="text-sm text-muted-foreground">Aucune catégorie disponible.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Tableau ligne par ligne
            {categoryParam ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                (filtre: {categoryParam})
              </span>
            ) : null}
          </CardTitle>
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
                <th className="py-2 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const isActive = lineParam && Number(lineParam) === item.line;
                return (
                  <tr
                    key={`${item.line}-${item.label}`}
                    id={`line-${item.line}`}
                    className={`border-t ${isActive ? "bg-emerald-50/60" : ""}`}
                  >
                  <td className="py-3 pr-4 text-muted-foreground">{item.line}</td>
                  <td className="py-3 pr-4">{item.date}</td>
                  <td className="py-3 pr-4">
                    <Link
                      className="font-medium text-emerald-700 hover:underline"
                      href={`/expenses/line/${item.line}`}
                    >
                      {item.label}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{formatCents(Math.round(item.amount * 100))}</td>
                  <td className="py-3 pr-4">{item.categorie}</td>
                  <td className="py-3 pr-4">
                    <div className="space-y-1">
                      <div>{item.lieu}</div>
                      <div className="text-muted-foreground">{item.type}</div>
                      <div className="text-emerald-700">{item.opportunite}</div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/expenses/line/${item.line}`}>Voir détails</Link>
                    </Button>
                  </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleItems.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Aucune ligne détectée. Refais un scan CSV.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assistant dépenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm text-muted-foreground">
            {chatMessages.length === 0 ? (
              <p>Pose une question sur tes dépenses filtrées, je t’aide à résumer.</p>
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
    </div>
  );
}
