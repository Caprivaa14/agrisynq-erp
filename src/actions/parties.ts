"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserContext, writeAuditLog } from "./context";

// ─── Zod Schemas ──────────────────────────────────────────────
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX   = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const PartySchema = z.object({
  // Core identity
  name:                   z.string().min(1, "Name is required").max(200),
  code:                   z.string().max(20).optional().or(z.literal("")),
  alias:                  z.string().max(200).optional().or(z.literal("")),

  // Legacy type (kept for backwards compat — new records use multi-role flags)
  party_type:             z.enum(["CUSTOMER", "SUPPLIER", "CF_AGENT", "BOTH"]),

  // Multi-role flags
  is_customer:            z.boolean().default(false),
  is_supplier:            z.boolean().default(false),
  is_cf_agent:            z.boolean().default(false),
  is_transporter:         z.boolean().default(false),
  is_wholesaler_licensed: z.boolean().default(false),
  is_retailer_licensed:   z.boolean().default(false),
  is_institutional:       z.boolean().default(false),

  // GST profile
  gstin:                  z.string().regex(GSTIN_REGEX, "Invalid GSTIN").optional().or(z.literal("")),
  gst_status:             z.enum(["REGULAR","COMPOSITION","UNREGISTERED","EXEMPT","SUSPENDED","CANCELLED"]).default("UNREGISTERED"),
  pan:                    z.string().regex(PAN_REGEX, "Invalid PAN format").optional().or(z.literal("")),
  state_code:             z.string().length(2).optional().or(z.literal("")),
  place_of_supply:        z.string().length(2).optional().or(z.literal("")),

  // Contact
  phone:                  z.string().max(15).optional().or(z.literal("")),
  alt_phone:              z.string().max(15).optional().or(z.literal("")),
  email:                  z.string().email("Invalid email").optional().or(z.literal("")),
  website:                z.string().url("Invalid URL").optional().or(z.literal("")),

  // Address
  address:                z.string().max(500).optional().or(z.literal("")),
  state:                  z.string().max(50).optional().or(z.literal("")),
  pincode:                z.string().max(10).optional().or(z.literal("")),

  // Credit terms
  credit_limit:           z.number().min(0).default(0),
  credit_days:            z.number().int().min(0).max(365).default(0),
  payment_terms_text:     z.string().max(200).optional().or(z.literal("")),

  // FMS identifiers
  fms_dealer_id:          z.string().max(50).optional().or(z.literal("")),
  fms_retailer_id:        z.string().max(50).optional().or(z.literal("")),
});

export type PartyFormState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// ─── Add Party ────────────────────────────────────────────────
export async function addParty(
  _prev: PartyFormState,
  formData: FormData
): Promise<PartyFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const raw = {
      name:                   formData.get("name") as string,
      code:                   (formData.get("code") as string) || "",
      alias:                  (formData.get("alias") as string) || "",
      party_type:             (formData.get("party_type") as string) || "CUSTOMER",
      is_customer:            formData.get("is_customer") === "true",
      is_supplier:            formData.get("is_supplier") === "true",
      is_cf_agent:            formData.get("is_cf_agent") === "true",
      is_transporter:         formData.get("is_transporter") === "true",
      is_wholesaler_licensed: formData.get("is_wholesaler_licensed") === "true",
      is_retailer_licensed:   formData.get("is_retailer_licensed") === "true",
      is_institutional:       formData.get("is_institutional") === "true",
      gstin:                  (formData.get("gstin") as string) || "",
      gst_status:             (formData.get("gst_status") as string) || "UNREGISTERED",
      pan:                    (formData.get("pan") as string) || "",
      state_code:             (formData.get("state_code") as string) || "",
      place_of_supply:        (formData.get("place_of_supply") as string) || "",
      phone:                  (formData.get("phone") as string) || "",
      alt_phone:              (formData.get("alt_phone") as string) || "",
      email:                  (formData.get("email") as string) || "",
      website:                (formData.get("website") as string) || "",
      address:                (formData.get("address") as string) || "",
      state:                  (formData.get("state") as string) || "",
      pincode:                (formData.get("pincode") as string) || "",
      credit_limit:           Number(formData.get("credit_limit") || 0),
      credit_days:            Number(formData.get("credit_days") || 0),
      payment_terms_text:     (formData.get("payment_terms_text") as string) || "",
      fms_dealer_id:          (formData.get("fms_dealer_id") as string) || "",
      fms_retailer_id:        (formData.get("fms_retailer_id") as string) || "",
    };

    const parsed = PartySchema.safeParse(raw);
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const d = parsed.data;
    const data = {
      tenant_id:              ctx.tenantId,
      organisation_id:        ctx.organisationId,
      name:                   d.name,
      code:                   d.code || null,
      alias:                  d.alias || null,
      party_type:             d.party_type,
      is_customer:            d.is_customer,
      is_supplier:            d.is_supplier,
      is_cf_agent:            d.is_cf_agent,
      is_transporter:         d.is_transporter,
      is_wholesaler_licensed: d.is_wholesaler_licensed,
      is_retailer_licensed:   d.is_retailer_licensed,
      is_institutional:       d.is_institutional,
      gstin:                  d.gstin || null,
      gst_status:             d.gst_status,
      pan:                    d.pan || null,
      state_code:             d.state_code || null,
      place_of_supply:        d.place_of_supply || null,
      phone:                  d.phone || null,
      alt_phone:              d.alt_phone || null,
      email:                  d.email || null,
      website:                d.website || null,
      address:                d.address || null,
      state:                  d.state || null,
      pincode:                d.pincode || null,
      credit_limit:           d.credit_limit,
      credit_days:            d.credit_days,
      payment_terms_text:     d.payment_terms_text || null,
      fms_dealer_id:          d.fms_dealer_id || null,
      fms_retailer_id:        d.fms_retailer_id || null,
      created_by:             ctx.userId,
    };

    const { data: inserted, error } = await supabase
      .from("parties")
      .insert([data])
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await writeAuditLog({ ctx, action: "INSERT", tableName: "parties", recordId: inserted?.id, newValues: data });
    revalidatePath("/master-data/parties");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to add party." };
  }
}

// ─── Update Party ─────────────────────────────────────────────
export async function updateParty(
  id: string,
  _prev: PartyFormState,
  formData: FormData
): Promise<PartyFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const raw = {
      name:                   formData.get("name") as string,
      code:                   (formData.get("code") as string) || "",
      alias:                  (formData.get("alias") as string) || "",
      party_type:             (formData.get("party_type") as string) || "CUSTOMER",
      is_customer:            formData.get("is_customer") === "true",
      is_supplier:            formData.get("is_supplier") === "true",
      is_cf_agent:            formData.get("is_cf_agent") === "true",
      is_transporter:         formData.get("is_transporter") === "true",
      is_wholesaler_licensed: formData.get("is_wholesaler_licensed") === "true",
      is_retailer_licensed:   formData.get("is_retailer_licensed") === "true",
      is_institutional:       formData.get("is_institutional") === "true",
      gstin:                  (formData.get("gstin") as string) || "",
      gst_status:             (formData.get("gst_status") as string) || "UNREGISTERED",
      pan:                    (formData.get("pan") as string) || "",
      state_code:             (formData.get("state_code") as string) || "",
      place_of_supply:        (formData.get("place_of_supply") as string) || "",
      phone:                  (formData.get("phone") as string) || "",
      alt_phone:              (formData.get("alt_phone") as string) || "",
      email:                  (formData.get("email") as string) || "",
      website:                (formData.get("website") as string) || "",
      address:                (formData.get("address") as string) || "",
      state:                  (formData.get("state") as string) || "",
      pincode:                (formData.get("pincode") as string) || "",
      credit_limit:           Number(formData.get("credit_limit") || 0),
      credit_days:            Number(formData.get("credit_days") || 0),
      payment_terms_text:     (formData.get("payment_terms_text") as string) || "",
      fms_dealer_id:          (formData.get("fms_dealer_id") as string) || "",
      fms_retailer_id:        (formData.get("fms_retailer_id") as string) || "",
    };

    const parsed = PartySchema.safeParse(raw);
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const d = parsed.data;
    const data = {
      name: d.name, code: d.code || null, alias: d.alias || null,
      party_type: d.party_type,
      is_customer: d.is_customer, is_supplier: d.is_supplier,
      is_cf_agent: d.is_cf_agent, is_transporter: d.is_transporter,
      is_wholesaler_licensed: d.is_wholesaler_licensed,
      is_retailer_licensed: d.is_retailer_licensed,
      is_institutional: d.is_institutional,
      gstin: d.gstin || null, gst_status: d.gst_status,
      pan: d.pan || null, state_code: d.state_code || null,
      place_of_supply: d.place_of_supply || null,
      phone: d.phone || null, alt_phone: d.alt_phone || null,
      email: d.email || null, website: d.website || null,
      address: d.address || null, state: d.state || null, pincode: d.pincode || null,
      credit_limit: d.credit_limit, credit_days: d.credit_days,
      payment_terms_text: d.payment_terms_text || null,
      fms_dealer_id: d.fms_dealer_id || null, fms_retailer_id: d.fms_retailer_id || null,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("parties").update(data).eq("id", id).eq("tenant_id", ctx.tenantId);

    if (error) throw new Error(error.message);

    await writeAuditLog({ ctx, action: "UPDATE", tableName: "parties", recordId: id, newValues: data });
    revalidatePath("/master-data/parties");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update party." };
  }
}

// ─── Archive Party ────────────────────────────────────────────
export async function archiveParty(id: string): Promise<PartyFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const { error } = await supabase
      .from("parties")
      .update({ is_active: false, archived_at: new Date().toISOString(), updated_by: ctx.userId })
      .eq("id", id).eq("tenant_id", ctx.tenantId);

    if (error) throw new Error(error.message);

    await writeAuditLog({ ctx, action: "ARCHIVE", tableName: "parties", recordId: id });
    revalidatePath("/master-data/parties");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to archive party." };
  }
}

// ─── Restore Party ────────────────────────────────────────────
export async function restoreParty(id: string): Promise<PartyFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const { error } = await supabase
      .from("parties")
      .update({ is_active: true, archived_at: null, updated_by: ctx.userId })
      .eq("id", id).eq("tenant_id", ctx.tenantId);

    if (error) throw new Error(error.message);

    await writeAuditLog({ ctx, action: "RESTORE", tableName: "parties", recordId: id });
    revalidatePath("/master-data/parties");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to restore party." };
  }
}

// ─── Get Parties ──────────────────────────────────────────────
export async function getParties(includeArchived = false) {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    let query = supabase
      .from("parties")
      .select("id,name,code,alias,party_type,is_customer,is_supplier,is_cf_agent,is_transporter,is_wholesaler_licensed,is_retailer_licensed,gstin,gst_status,phone,alt_phone,email,state,credit_limit,credit_days,fms_dealer_id,is_active,created_at")
      .eq("tenant_id", ctx.tenantId)
      .order("name", { ascending: true });

    if (!includeArchived) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (err) {
    console.error("[parties] getParties error:", err);
    return [];
  }
}
