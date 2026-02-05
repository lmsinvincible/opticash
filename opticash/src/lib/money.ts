export const formatEUR = (value: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatCents = (value: bigint | number | string | null | undefined) => {
  if (value === null || value === undefined) {
    return "—";
  }

  let cents: bigint | null = null;
  if (typeof value === "bigint") {
    cents = value;
  } else if (typeof value === "string") {
    if (/^-?\d+$/.test(value.trim())) {
      cents = BigInt(value.trim());
    } else {
      const num = Number(value);
      if (!Number.isFinite(num)) return "—";
      cents = BigInt(Math.round(num));
    }
  } else if (Number.isFinite(value)) {
    cents = BigInt(Math.round(value));
  }

  if (cents === null) {
    return "—";
  }

  const euros = Number(cents) / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(euros);
};
