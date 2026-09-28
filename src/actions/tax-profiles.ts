"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserContext, writeAuditLog } from "./context";

// ─── Zod Schema ───────────────────────────────────────────────
const TaxProfileSchema = z.object({
  product_category:   z.string().max(50).optional().or(z.literal("")),
  hsn_code:           z.string().min(4).max(8).regex(/^\d{4,8}$/, "HSN must be 4–8 digits"),
  description:        z.string().max(200).optional().or(z.literal("")),
  gst_rate:           z.number().min(0).max(100),
  cess_rate:          z.number().min(0).max(100).default(0),
  is_exempt:          z.boolean().default(false),
  is_nil_rated:       z.boolean().default(false),
  exemption_reason:   z.string().max(300).optional().or(z.literal("")),
  effective_from:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  effective_to:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
}).refine(
  (d) => {
    if (!d.effective_to) return true;
    return new Date(d.effective_to) >= new Date(d.effective_from);
  },
  { message: "Effective-to must be on or after effective-from", path: ["effective_to"] }
);

export type TaxProfileFormState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// ─── Add Tax Profile ──────────────────────────────────────────
export async function addTaxProfile(
  _prev: TaxProfileFormState,
  formData: FormData
): Promise<TaxProfileFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const gst_rate = Number(formData.get("gst_rate") || 0);
    const raw = {
      product_category:   (formData.get("product_category") as string) || "",
      hsn_code:           formData.get("hsn_code") as string,
      description:        (formData.get("description") as string) || "",
      gst_rate,
      cess_rate:          Number(formData.get("cess_rate") || 0),
      is_exempt:          formData.get("is_exempt") === "true",
      is_nil_rated:       formData.get("is_nil_rated") === "true",
      exemption_reason:   (formData.get("exemption_reason") as string) || "",
      effective_from:     formData.get("effective_from") as string,
      effective_to:       (formData.get("effective_to") as string) || "",
    };

    const parsed = TaxProfileSchema.safeParse(raw);
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const d = parsed.data;
    // Compute CGST/SGST/IGST from GST rate
    const half_rate = d.gst_rate / 2;
    const data = {
      tenant_id:          ctx.tenantId,
      product_category:   d.product_category || null,
      hsn_code:           d.hsn_code,
      description:        d.description || null,
      gst_rate:           d.gst_rate,
      cgst_rate:          half_rate,
      sgst_rate:          half_rate,
      igst_rate:          d.gst_rate,
      cess_rate:          d.cess_rate,
      is_exempt:          d.is_exempt,
      is_nil_rated:       d.is_nil_rated,
      exemption_reason:   d.exemption_reason || null,
      effective_from:     d.effective_from,
      effective_to:       d.effective_to || null,
      created_by:         ctx.userId,
    };

    const { data: inserted, error } = await supabase
      .from("tax_profiles").insert([data]).select("id").single();

    if (error) throw new Error(error.message);

    await writeAuditLog({ ctx, action: "INSERT", tableName: "tax_profiles", recordId: inserted?.id, newValues: data });
    revalidatePath("/admin/tax-profiles");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to add tax profile." };
  }
}

// ─── Update Tax Profile ───────────────────────────────────────
export async function updateTaxProfile(
  id: string,
  _prev: TaxProfileFormState,
  formData: FormData
): Promise<TaxProfileFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const gst_rate = Number(formData.get("gst_rate") || 0);
    const raw = {
      product_category:   (formData.get("product_category") as string) || "",
      hsn_code:           formData.get("hsn_code") as string,
      description:        (formData.get("description") as string) || "",
      gst_rate,
      cess_rate:          Number(formData.get("cess_rate") || 0),
      is_exempt:          formData.get("is_exempt") === "true",
      is_nil_rated:       formData.get("is_nil_rated") === "true",
      exemption_reason:   (formData.get("exemption_reason") as string) || "",
      effective_from:     formData.get("effective_from") as string,
      effective_to:       (formData.get("effective_to") as string) || "",
    };

    const parsed = TaxProfileSchema.safeParse(raw);
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const d = parsed.data;
    const half_rate = d.gst_rate / 2;
    const data = {
      product_category: d.product_category || null,
      hsn_code: d.hsn_code, description: d.description || null,
      gst_rate: d.gst_rate, cgst_rate: half_rate, sgst_rate: half_rate, igst_rate: d.gst_rate,
      cess_rate: d.cess_rate, is_exempt: d.is_exempt, is_nil_rated: d.is_nil_rated,
      exemption_reason: d.exemption_reason || null,
      effective_from: d.effective_from, effective_to: d.effective_to || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("tax_profiles").update(data).eq("id", id).eq("tenant_id", ctx.tenantId);

    if (error) throw new Error(error.message);

    await writeAuditLog({ ctx, action: "UPDATE", tableName: "tax_profiles", recordId: id, newValues: data });
    revalidatePath("/admin/tax-profiles");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update tax profile." };
  }
}

// ─── Get Tax Profiles ─────────────────────────────────────────
export async function getTaxProfiles() {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const { data, error } = await supabase
      .from("tax_profiles")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("hsn_code", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (err) {
    console.error("[tax-profiles] getTaxProfiles error:", err);
    return [];
  }
}
