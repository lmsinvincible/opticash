export type ExpenseRow = {
  line: number;
  date: string;
  label: string;
  amount: number;
  categorie: string;
  lieu: string;
  type: string;
  opportunite: string;
};

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const deslugify = (value: string) =>
  value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const groupByCategory = (items: ExpenseRow[]) => {
  const map = new Map<string, ExpenseRow[]>();
  items.forEach((item) => {
    const category = item.categorie || "Non classé";
    if (!map.has(category)) map.set(category, []);
    map.get(category)?.push(item);
  });
  return Array.from(map.entries()).map(([category, rows]) => ({
    category,
    slug: slugify(category),
    count: rows.length,
    total: rows.reduce((acc, row) => acc + row.amount, 0),
  }));
};

export const groupByMerchant = (items: ExpenseRow[]) => {
  const map = new Map<string, ExpenseRow[]>();
  items.forEach((item) => {
    const merchant = item.label || "Inconnu";
    if (!map.has(merchant)) map.set(merchant, []);
    map.get(merchant)?.push(item);
  });
  return Array.from(map.entries()).map(([merchant, rows]) => ({
    merchant,
    slug: slugify(merchant),
    count: rows.length,
    total: rows.reduce((acc, row) => acc + row.amount, 0),
  }));
};

export const readExpensesCache = () => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("opticash:expenses_cache");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ExpenseRow[];
  } catch {
    return null;
  }
};

export const writeExpensesCache = (items: ExpenseRow[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem("opticash:expenses_cache", JSON.stringify(items));
};
