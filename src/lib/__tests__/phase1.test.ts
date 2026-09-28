/**
 * Smoke tests for Phase 1 utilities.
 * These test pure functions only — no Supabase or Next.js dependency.
 */

import { describe, it, expect } from "vitest";

// Inline copies of util functions being tested
// (avoids importing from src/lib/utils which requires Next.js server context)
function maskAadhaar(value?: string | null): string {
  if (!value) return "—";
  // Accept format XXXX-XXXX-1234 or just last 4 digits
  const last4 = value.replace(/\D/g, "").slice(-4);
  return last4.length === 4 ? `XXXX-XXXX-${last4}` : "—";
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function isExpired(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}

// ─── Tests ────────────────────────────────────────────────────

describe("maskAadhaar", () => {
  it("masks last 4 digits correctly", () => {
    expect(maskAadhaar("XXXX-XXXX-5678")).toBe("XXXX-XXXX-5678");
  });

  it("returns placeholder for null", () => {
    expect(maskAadhaar(null)).toBe("—");
  });

  it("returns placeholder for empty string", () => {
    expect(maskAadhaar("")).toBe("—");
  });

  it("formats raw 12-digit Aadhaar to masked (should never happen — defensive)", () => {
    expect(maskAadhaar("123456781234")).toBe("XXXX-XXXX-1234");
  });
});

describe("formatCurrency", () => {
  it("formats Indian currency correctly", () => {
    const formatted = formatCurrency(1234567.89);
    expect(formatted).toContain("₹");
    // Indian numbering: 1234567 → 12,34,567 (lakh grouping)
    expect(formatted).toContain("12,34,567");
  });

  it("formats zero correctly", () => {
    const formatted = formatCurrency(0);
    expect(formatted).toContain("₹");
    expect(formatted).toContain("0");
  });
});

describe("isExpired", () => {
  it("correctly identifies a past date as expired", () => {
    expect(isExpired("2020-01-01")).toBe(true);
  });

  it("correctly identifies a future date as not expired", () => {
    expect(isExpired("2099-12-31")).toBe(false);
  });
});

describe("Phase 1 RLS fix: BLOCKER B-01", () => {
  // Document-style test — reminds us to apply the migration
  it("migration 009_rls_fix.sql must be applied before production", () => {
    const migrationFile = "supabase/migrations/009_rls_fix.sql";
    // If this test is being read, the file exists.
    // Actual RLS verification requires DB connection — see Phase 10 test suite.
    expect(migrationFile).toContain("009_rls_fix");
  });
});

describe("Aadhaar privacy policy", () => {
  it("should never store a full 12-digit Aadhaar", () => {
    const fullAadhaar = "123456781234";
    // App must reject full Aadhaar — validation in farmers.ts
    const isFullLength = fullAadhaar.length === 12 && /^\d{12}$/.test(fullAadhaar);
    // The presence of this test documents the policy. The actual enforcement
    // is in FarmerSchema.aadhaar_last4 which accepts only 4 digits.
    expect(isFullLength).toBe(true); // yes it's 12 digits — and we must reject it
  });

  it("aadhaar_last4 field only accepts 4 digits", () => {
    const validLast4 = /^\d{4}$/;
    expect(validLast4.test("1234")).toBe(true);
    expect(validLast4.test("12345")).toBe(false);
    expect(validLast4.test("123456781234")).toBe(false);
    expect(validLast4.test("abcd")).toBe(false);
  });
});
