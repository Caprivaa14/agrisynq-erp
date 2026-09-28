"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserContext, writeAuditLog } from "./context";

// ─── Zod Schema ───────────────────────────────────────────────
const FarmerSchema = z.object({
  first_name:             z.string().min(1, "First name is required").max(100),
  last_name:              z.string().max(100).optional().or(z.literal("")),
  father_spouse_name:     z.string().max(100).optional().or(z.literal("")),
  phone:                  z.string().regex(/^[6-9]\d{9}$/, "Valid 10-digit mobile required").optional().or(z.literal("")),
  alt_phone:              z.string().max(15).optional().or(z.literal("")),
  // Address / geo
  village:                z.string().max(100).optional().or(z.literal("")),
  gram_panchayat:         z.string().max(100).optional().or(z.literal("")),
  block_name:             z.string().max(100).optional().or(z.literal("")),
  district:               z.string().max(100).optional().or(z.literal("")),
  state:                  z.string().max(50).optional().or(z.literal("")),
  pin:                    z.string().max(6).optional().or(z.literal("")),
  // Agriculture identity
  farmer_registration_no: z.string().max(50).optional().or(z.literal("")),
  land_category:          z.enum(["OWNER","TENANT","SHARECROPPER","OTHER"]).default("OWNER"),
  cultivated_area_acres:  z.number().min(0).max(9999).optional().nullable(),
  primary_crop:           z.string().max(100).optional().or(z.literal("")),
  primary_season:         z.string().max(50).optional().or(z.literal("")),
  land_record_ref:        z.string().max(100).optional().or(z.literal("")),
  kisan_credit_card_ref:  z.string().max(100).optional().or(z.literal("")),
  // Aadhaar — ONLY last 4 digits accepted from UI
  aadhaar_last4:          z.string().regex(/^\d{4}$/, "Enter exactly 4 digits").optional().or(z.literal("")),
  // KYC
  kyc_status:             z.enum(["NOT_COLLECTED","PARTIAL","COMPLETE","VERIFIED"]).default("NOT_COLLECTED"),
  consent_date:           z.string().optional().or(z.literal("")),
  consent_mode:           z.string().max(20).optional().or(z.literal("")),
});

export type FarmerFormState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// ─── Generate Farmer Code ─────────────────────────────────────
async function generateFarmerCode(orgId: string, tenantId: string): Promise<string> {
  try {
    const supabase = createClient();
    const { count } = await supabase
      .from("farmers")
      .select("*", { count: "exact", head: true })
      .eq("organisation_id", orgId)
      .eq("tenant_id", tenantId);
    const n = (count ?? 0) + 1;
    return `FRM-${String(n).padStart(6, "0")}`;
  } catch {
    return `FRM-${Date.now()}`;
  }
}

// ─── Add Farmer ───────────────────────────────────────────────
export async function addFarmer(
  _prev: FarmerFormState,
  formData: FormData
): Promise<FarmerFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const raw = {
      first_name:             formData.get("first_name") as string,
      last_name:              (formData.get("last_name") as string) || "",
      father_spouse_name:     (formData.get("father_spouse_name") as string) || "",
      phone:                  (formData.get("phone") as string) || "",
      alt_phone:              (formData.get("alt_phone") as string) || "",
      village:                (formData.get("village") as string) || "",
      gram_panchayat:         (formData.get("gram_panchayat") as string) || "",
      block_name:             (formData.get("block_name") as string) || "",
      district:               (formData.get("district") as string) || "",
      state:                  (formData.get("state") as string) || "",
      pin:                    (formData.get("pin") as string) || "",
      farmer_registration_no: (formData.get("farmer_registration_no") as string) || "",
      land_category:          (formData.get("land_category") as string) || "OWNER",
      cultivated_area_acres:  formData.get("cultivated_area_acres") ? Number(formData.get("cultivated_area_acres")) : null,
      primary_crop:           (formData.get("primary_crop") as string) || "",
      primary_season:         (formData.get("primary_season") as string) || "",
      land_record_ref:        (formData.get("land_record_ref") as string) || "",
      kisan_credit_card_ref:  (formData.get("kisan_credit_card_ref") as string) || "",
      aadhaar_last4:          (formData.get("aadhaar_last4") as string) || "",
      kyc_status:             (formData.get("kyc_status") as string) || "NOT_COLLECTED",
      consent_date:           (formData.get("consent_date") as string) || "",
      consent_mode:           (formData.get("consent_mode") as string) || "",
    };

    const parsed = FarmerSchema.safeParse(raw);
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const d = parsed.data;
    const farmerCode = await generateFarmerCode(ctx.organisationId, ctx.tenantId);

    const data = {
      tenant_id:              ctx.tenantId,
      organisation_id:        ctx.organisationId,
      farmer_code:            farmerCode,
      first_name:             d.first_name,
      last_name:              d.last_name || null,
      father_spouse_name:     d.father_spouse_name || null,
      phone:                  d.phone || null,
      alt_phone:              d.alt_phone || null,
      village:                d.village || null,
      gram_panchayat:         d.gram_panchayat || null,
      block_name:             d.block_name || null,
      district:               d.district || null,
      state:                  d.state || null,
      pin:                    d.pin || null,
      farmer_registration_no: d.farmer_registration_no || null,
      land_category:          d.land_category,
      cultivated_area_acres:  d.cultivated_area_acres,
      land_area_acres:        d.cultivated_area_acres, // keep old column in sync
      primary_crop:           d.primary_crop || null,
      primary_season:         d.primary_season || null,
      land_record_ref:        d.land_record_ref || null,
      kisan_credit_card_ref:  d.kisan_credit_card_ref || null,
      // Aadhaar — store only last 4; masked format in legacy column
      aadhaar_last4:          d.aadhaar_last4 || null,
      aadhaar_number:         d.aadhaar_last4 ? `XXXX-XXXX-${d.aadhaar_last4}` : null,
      kyc_status:             d.kyc_status,
      consent_date:           d.consent_date || null,
      consent_mode:           d.consent_mode || null,
      created_by:             ctx.userId,
    };

    const { data: inserted, error } = await supabase
      .from("farmers").insert([data]).select("id").single();

    if (error) throw new Error(error.message);

    // Redact Aadhaar from audit log
    await writeAuditLog({
      ctx, action: "INSERT", tableName: "farmers", recordId: inserted?.id,
      newValues: { ...data, aadhaar_last4: data.aadhaar_last4 ? "****" : null, aadhaar_number: "[MASKED]" },
    });

    revalidatePath("/master-data/farmers");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to add farmer." };
  }
}

// ─── Update Farmer ────────────────────────────────────────────
export async function updateFarmer(
  id: string,
  _prev: FarmerFormState,
  formData: FormData
): Promise<FarmerFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const raw = {
      first_name:             formData.get("first_name") as string,
      last_name:              (formData.get("last_name") as string) || "",
      father_spouse_name:     (formData.get("father_spouse_name") as string) || "",
      phone:                  (formData.get("phone") as string) || "",
      alt_phone:              (formData.get("alt_phone") as string) || "",
      village:                (formData.get("village") as string) || "",
      gram_panchayat:         (formData.get("gram_panchayat") as string) || "",
      block_name:             (formData.get("block_name") as string) || "",
      district:               (formData.get("district") as string) || "",
      state:                  (formData.get("state") as string) || "",
      pin:                    (formData.get("pin") as string) || "",
      farmer_registration_no: (formData.get("farmer_registration_no") as string) || "",
      land_category:          (formData.get("land_category") as string) || "OWNER",
      cultivated_area_acres:  formData.get("cultivated_area_acres") ? Number(formData.get("cultivated_area_acres")) : null,
      primary_crop:           (formData.get("primary_crop") as string) || "",
      primary_season:         (formData.get("primary_season") as string) || "",
      land_record_ref:        (formData.get("land_record_ref") as string) || "",
      kisan_credit_card_ref:  (formData.get("kisan_credit_card_ref") as string) || "",
      aadhaar_last4:          (formData.get("aadhaar_last4") as string) || "",
      kyc_status:             (formData.get("kyc_status") as string) || "NOT_COLLECTED",
      consent_date:           (formData.get("consent_date") as string) || "",
      consent_mode:           (formData.get("consent_mode") as string) || "",
    };

    const parsed = FarmerSchema.safeParse(raw);
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const d = parsed.data;
    const data = {
      first_name: d.first_name, last_name: d.last_name || null,
      father_spouse_name: d.father_spouse_name || null,
      phone: d.phone || null, alt_phone: d.alt_phone || null,
      village: d.village || null, gram_panchayat: d.gram_panchayat || null,
      block_name: d.block_name || null, district: d.district || null,
      state: d.state || null, pin: d.pin || null,
      farmer_registration_no: d.farmer_registration_no || null,
      land_category: d.land_category,
      cultivated_area_acres: d.cultivated_area_acres,
      land_area_acres: d.cultivated_area_acres,
      primary_crop: d.primary_crop || null, primary_season: d.primary_season || null,
      land_record_ref: d.land_record_ref || null,
      kisan_credit_card_ref: d.kisan_credit_card_ref || null,
      aadhaar_last4: d.aadhaar_last4 || null,
      aadhaar_number: d.aadhaar_last4 ? `XXXX-XXXX-${d.aadhaar_last4}` : null,
      kyc_status: d.kyc_status,
      consent_date: d.consent_date || null, consent_mode: d.consent_mode || null,
      updated_by: ctx.userId, updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("farmers").update(data).eq("id", id).eq("tenant_id", ctx.tenantId);

    if (error) throw new Error(error.message);

    await writeAuditLog({
      ctx, action: "UPDATE", tableName: "farmers", recordId: id,
      newValues: { ...data, aadhaar_last4: "****", aadhaar_number: "[MASKED]" },
    });

    revalidatePath("/master-data/farmers");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update farmer." };
  }
}

// ─── Archive Farmer (statutory records — never hard-delete) ──
export async function archiveFarmer(id: string): Promise<FarmerFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();
    const { error } = await supabase.from("farmers")
      .update({ is_active: false, archived_at: new Date().toISOString(), updated_by: ctx.userId })
      .eq("id", id).eq("tenant_id", ctx.tenantId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ ctx, action: "ARCHIVE", tableName: "farmers", recordId: id });
    revalidatePath("/master-data/farmers");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to archive farmer." };
  }
}

// ─── Get Farmers ──────────────────────────────────────────────
export async function getFarmers(includeArchived = false) {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    let query = supabase
      .from("farmers")
      .select("id,farmer_code,first_name,last_name,phone,village,district,state,land_category,cultivated_area_acres,aadhaar_last4,kyc_status,is_active,created_at")
      .eq("tenant_id", ctx.tenantId)
      .order("first_name", { ascending: true });

    if (!includeArchived) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (err) {
    console.error("[farmers] getFarmers error:", err);
    return [];
  }
}
