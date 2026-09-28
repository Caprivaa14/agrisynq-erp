"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserContext, writeAuditLog } from "./context";

// ─── Zod Schema ───────────────────────────────────────────────
const LicenceSchema = z.object({
  licence_number:       z.string().min(1, "Licence number is required").max(100),
  licence_type:         z.enum(["FERTILIZER","PESTICIDE","SEED","RETAIL","FERTILIZER_WHOLESALE","FERTILIZER_RETAIL","INSECTICIDE","STORAGE"]),
  entity_type:          z.enum(["ORGANISATION","PARTY","BRANCH","LOCATION"]).default("ORGANISATION"),
  entity_id:            z.string().uuid("Invalid entity").optional().or(z.literal("")),
  valid_from:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  valid_to:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  issuing_authority:    z.string().max(200).optional().or(z.literal("")),
  approved_premises:    z.string().max(500).optional().or(z.literal("")),
  approved_categories:  z.array(z.string()).default([]),
  renewal_reminder_days: z.number().int().min(1).max(180).default(30),
  status:               z.enum(["ACTIVE","EXPIRED","SUSPENDED","CANCELLED","PENDING_RENEWAL"]).default("ACTIVE"),
  // Legacy fields (kept for backward compat)
  location_id:          z.string().uuid().optional().or(z.literal("")),
  party_id:             z.string().uuid().optional().or(z.literal("")),
}).refine(
  (d) => new Date(d.valid_to) >= new Date(d.valid_from),
  { message: "Expiry must be on or after valid-from date", path: ["valid_to"] }
);

export type LicenceFormState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// ─── Add Licence ──────────────────────────────────────────────
export async function addLicence(
  _prev: LicenceFormState,
  formData: FormData
): Promise<LicenceFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    // Parse approved_categories from comma-separated string or JSON array
    let approved_categories: string[] = [];
    const cats = formData.get("approved_categories") as string;
    if (cats) {
      try { approved_categories = JSON.parse(cats); }
      catch { approved_categories = cats.split(",").map((c) => c.trim()).filter(Boolean); }
    }

    const raw = {
      licence_number:       formData.get("licence_number") as string,
      licence_type:         formData.get("licence_type") as string,
      entity_type:          (formData.get("entity_type") as string) || "ORGANISATION",
      entity_id:            (formData.get("entity_id") as string) || "",
      valid_from:           formData.get("valid_from") as string,
      valid_to:             formData.get("valid_to") as string,
      issuing_authority:    (formData.get("issuing_authority") as string) || "",
      approved_premises:    (formData.get("approved_premises") as string) || "",
      approved_categories,
      renewal_reminder_days: Number(formData.get("renewal_reminder_days") || 30),
      status:               (formData.get("status") as string) || "ACTIVE",
      location_id:          (formData.get("location_id") as string) || "",
      party_id:             (formData.get("party_id") as string) || "",
    };

    const parsed = LicenceSchema.safeParse(raw);
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const d = parsed.data;
    const data = {
      tenant_id:            ctx.tenantId,
      organisation_id:      ctx.organisationId,
      licence_number:       d.licence_number,
      licence_type:         d.licence_type,
      entity_type:          d.entity_type,
      entity_id:            d.entity_id || null,
      valid_from:           d.valid_from,
      valid_to:             d.valid_to,
      issuing_authority:    d.issuing_authority || null,
      approved_premises:    d.approved_premises || null,
      approved_categories:  d.approved_categories,
      renewal_reminder_days: d.renewal_reminder_days,
      status:               d.status,
      location_id:          d.location_id || null,
      party_id:             d.party_id || null,
      created_by:           ctx.userId,
    };

    const { data: inserted, error } = await supabase
      .from("licences").insert([data]).select("id").single();

    if (error) throw new Error(error.message);

    await writeAuditLog({ ctx, action: "INSERT", tableName: "licences", recordId: inserted?.id, newValues: data });
    revalidatePath("/master-data/licences");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to add licence." };
  }
}

// ─── Update Licence ───────────────────────────────────────────
export async function updateLicence(
  id: string,
  _prev: LicenceFormState,
  formData: FormData
): Promise<LicenceFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    let approved_categories: string[] = [];
    const cats = formData.get("approved_categories") as string;
    if (cats) {
      try { approved_categories = JSON.parse(cats); }
      catch { approved_categories = cats.split(",").map((c) => c.trim()).filter(Boolean); }
    }

    const raw = {
      licence_number:       formData.get("licence_number") as string,
      licence_type:         formData.get("licence_type") as string,
      entity_type:          (formData.get("entity_type") as string) || "ORGANISATION",
      entity_id:            (formData.get("entity_id") as string) || "",
      valid_from:           formData.get("valid_from") as string,
      valid_to:             formData.get("valid_to") as string,
      issuing_authority:    (formData.get("issuing_authority") as string) || "",
      approved_premises:    (formData.get("approved_premises") as string) || "",
      approved_categories,
      renewal_reminder_days: Number(formData.get("renewal_reminder_days") || 30),
      status:               (formData.get("status") as string) || "ACTIVE",
      location_id:          (formData.get("location_id") as string) || "",
      party_id:             (formData.get("party_id") as string) || "",
    };

    const parsed = LicenceSchema.safeParse(raw);
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const d = parsed.data;
    const data = {
      licence_number: d.licence_number, licence_type: d.licence_type,
      entity_type: d.entity_type, entity_id: d.entity_id || null,
      valid_from: d.valid_from, valid_to: d.valid_to,
      issuing_authority: d.issuing_authority || null,
      approved_premises: d.approved_premises || null,
      approved_categories: d.approved_categories,
      renewal_reminder_days: d.renewal_reminder_days,
      status: d.status,
      location_id: d.location_id || null, party_id: d.party_id || null,
      updated_by: ctx.userId, updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("licences").update(data).eq("id", id).eq("tenant_id", ctx.tenantId);

    if (error) throw new Error(error.message);

    await writeAuditLog({ ctx, action: "UPDATE", tableName: "licences", recordId: id, newValues: data });
    revalidatePath("/master-data/licences");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update licence." };
  }
}

// ─── Get Licences ─────────────────────────────────────────────
export async function getLicences(includeArchived = false) {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    let query = supabase
      .from("licences")
      .select("id,licence_number,licence_type,entity_type,entity_id,valid_from,valid_to,issuing_authority,approved_categories,status,is_active,created_at")
      .eq("tenant_id", ctx.tenantId)
      .order("valid_to", { ascending: true });

    if (!includeArchived) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (err) {
    console.error("[licences] getLicences error:", err);
    return [];
  }
}

// ─── Get Expiring Licences (for dashboard alert) ──────────────
export async function getExpiringLicences(days = 60) {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const { data, error } = await supabase
      .from("licences")
      .select("id,licence_number,licence_type,entity_type,valid_to,status,renewal_reminder_days")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .neq("status", "CANCELLED")
      .lte("valid_to", futureDate.toISOString().split("T")[0])
      .gte("valid_to", new Date().toISOString().split("T")[0])
      .order("valid_to", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (err) {
    console.error("[licences] getExpiringLicences error:", err);
    return [];
  }
}
