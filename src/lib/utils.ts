import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges Tailwind classes safely, resolving conflicts */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format number as Indian currency: ₹1,23,456.78 */
export function formatCurrency(
  amount: number,
  opts?: { showSymbol?: boolean; decimals?: number }
): string {
  const { showSymbol = true, decimals = 2 } = opts ?? {};
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
  return showSymbol ? `₹${formatted}` : formatted;
}

/** Format date as DD/MM/YYYY */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Format date with time: DD/MM/YYYY HH:MM */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
}

/** Format a sequence number into an invoice number: INV-2025-001234 */
export function formatInvoiceNumber(prefix: string, seq: number, pad = 6): string {
  return `${prefix}-${String(seq).padStart(pad, "0")}`;
}

/** Mask Aadhaar — always returns XXXX-XXXX-NNNN format */
export function maskAadhaar(last4: string): string {
  return `XXXX-XXXX-${last4.replace(/\D/g, "").slice(-4).padStart(4, "0")}`;
}

/** Returns initials from a name: "Rajesh Kumar" → "RK" */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Check if a date is in the past */
export function isExpired(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  return d < new Date();
}

/** Days remaining until a date */
export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = d.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
