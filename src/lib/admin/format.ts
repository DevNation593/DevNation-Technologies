const ECUADOR_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Fecha actual en Ecuador (UTC-5) en formato YYYY-MM-DD. */
export function todayInEcuador(): string {
  return new Date(Date.now() - ECUADOR_OFFSET_MS).toISOString().slice(0, 10);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-EC", {
    timeZone: "America/Guayaquil",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function addDays(iso: string, days: number): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + Number(days || 0));
  return formatDate(
    [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"),
  );
}

export function formatMoney(value: number, currency: "USD" | "EUR" = "USD"): string {
  const symbol = currency === "EUR" ? "€" : "$";
  return (
    symbol +
    Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export function formatPercent(value: number): string {
  return `${Number(value || 0).toFixed(2).replace(/\.00$/, "")}%`;
}

export function invoiceNumber(estab: string | null, ptoEmi: string | null, secuencial: string | null): string {
  if (!estab || !ptoEmi || !secuencial) return "Sin numerar";
  return `${estab}-${ptoEmi}-${secuencial}`;
}
