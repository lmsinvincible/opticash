export const formatEUR = (value: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatCents = (value: bigint | number | string) => {
  let cents: bigint;
  if (typeof value === "bigint") {
    cents = value;
  } else if (typeof value === "string") {
    cents = BigInt(value);
  } else {
    cents = BigInt(Math.round(value));
  }

  const euros = Number(cents) / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(euros);
};
