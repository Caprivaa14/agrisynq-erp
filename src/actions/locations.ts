"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserContext, writeAuditLog } from "./context";

// ─── Zod Schemas ──────────────────────────────────────────────
const LocationSchema = z.object({
  name:                       z.string().min(1, "Location name is required").max(200),
  code:                       z.string().max(20).optional().or(z.literal("")),
  location_type:              z.enum(["OWN","CF_DEPOT","QUARANTINE","VIRTUAL","BRANCH_WAREHOUSE","COMPANY_DEPOT","THIRD_PARTY","IN_TRANSIT","DAMAGED","EXPIRED","CUSTOMER_CONSIGNMENT"]),
  ownership:                  z.enum(["OWN","CF_AGENT","COMPANY","THIRD_PARTY","GOVERNMENT"]).default("OWN"),
  custodian_party_id:         z.string().uuid("Invalid party").optional().or(z.literal("")),
  address:                    z.string().max(500).optional().or(z.literal("")),
  state:                      z.string().max(50).optional().or(z.literal("")),
  pincode:                    z.string().max(10).optional().or(z.literal("")),
  gst_state:                  z.string().max(50).optional().or(z.literal("")),
  gstin_of_location:          z.string().max(20).optional().or(z.literal("")),
  licence_no:                 z.string().max(100).optional().or(z.literal("")),
  contact_person:             z.string().max(100).optional().or(z.literal("")),
  contact_phone:              z.string().max(15).optional().or(z.literal("")),
  capacity_sqft:              z.number().min(0).optional().nullable(),
  stock_confirmation_freq_days: z.number().int().min(1).max(365).default(30),
});

export type LocationFormState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// ─── Add Location ─────────────────────────────────────────────
export async function addLocation(
  _prev: LocationFormState,
  formData: FormData
): Promise<LocationFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const raw = {
      name:                       formData.get("name") as string,
      code:                       (formData.get("code") as string) || "",
      location_type:              formData.get("location_type") as string,
      ownership:                  (formData.get("ownership") as string) || "OWN",
      custodian_party_id:         (formData.get("custodian_party_id") as string) || "",
      address:                    (formData.get("address") as string) || "",
      state:                      (formData.get("state") as string) || "",
      pincode:                    (formData.get("pincode") as string) || "",
      gst_state:                  (formData.get("gst_state") as string) || "",
      gstin_of_location:          (formData.get("gstin_of_location") as string) || "",
      licence_no:                 (formData.get("licence_no") as string) || "",
      contact_person:             (formData.get("contact_person") as string) || "",
      contact_phone:              (formData.get("contact_phone") as string) || "",
      capacity_sqft:              formData.get("capacity_sqft") ? Number(formData.get("capacity_sqft")) : null,
      stock_confirmation_freq_days: Number(formData.get("stock_confirmation_freq_days") || 30),
    };

    const parsed = LocationSchema.safeParse(raw);
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const d = parsed.data;
    const data = {
      tenant_id:                  ctx.tenantId,
      organisation_id:            ctx.organisationId,
      branch_id:                  ctx.branchId,
      name:                       d.name,
      code:                       d.code || null,
      location_type:              d.location_type,
      ownership:                  d.ownership,
      custodian_party_id:         d.custodian_party_id || null,
      address:                    d.address || null,
      state:                      d.state || null,
      pincode:                    d.pincode || null,
      gst_state:                  d.gst_state || null,
      gstin_of_location:          d.gstin_of_location || null,
      licence_no:                 d.licence_no || null,
      contact_person:             d.contact_person || null,
      contact_phone:              d.contact_phone || null,
      capacity_sqft:              d.capacity_sqft,
      stock_confirmation_freq_days: d.stock_confirmation_freq_days,
      created_by:                 ctx.userId,
    };

    const { data: inserted, error } = await supabase
      .from("locations").insert([data]).select("id").single();

    if (error) throw new Error(error.message);

    await writeAuditLog({ ctx, action: "INSERT", tableName: "locations", recordId: inserted?.id, newValues: data });
    revalidatePath("/master-data/locations");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to add location." };
  }
}

// ─── Update Location ──────────────────────────────────────────
export async function updateLocation(
  id: string,
  _prev: LocationFormState,
  formData: FormData
): Promise<LocationFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const raw = {
      name:                       formData.get("name") as string,
      code:                       (formData.get("code") as string) || "",
      location_type:              formData.get("location_type") as string,
      ownership:                  (formData.get("ownership") as string) || "OWN",
      custodian_party_id:         (formData.get("custodian_party_id") as string) || "",
      address:                    (formData.get("address") as string) || "",
      state:                      (formData.get("state") as string) || "",
      pincode:                    (formData.get("pincode") as string) || "",
      gst_state:                  (formData.get("gst_state") as string) || "",
      gstin_of_location:          (formData.get("gstin_of_location") as string) || "",
      licence_no:                 (formData.get("licence_no") as string) || "",
      contact_person:             (formData.get("contact_person") as string) || "",
      contact_phone:              (formData.get("contact_phone") as string) || "",
      capacity_sqft:              formData.get("capacity_sqft") ? Number(formData.get("capacity_sqft")) : null,
      stock_confirmation_freq_days: Number(formData.get("stock_confirmation_freq_days") || 30),
    };

    const parsed = LocationSchema.safeParse(raw);
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const d = parsed.data;
    const data = {
      name: d.name, code: d.code || null, location_type: d.location_type,
      ownership: d.ownership, custodian_party_id: d.custodian_party_id || null,
      address: d.address || null, state: d.state || null, pincode: d.pincode || null,
      gst_state: d.gst_state || null, gstin_of_location: d.gstin_of_location || null,
      licence_no: d.licence_no || null, contact_person: d.contact_person || null,
      contact_phone: d.contact_phone || null, capacity_sqft: d.capacity_sqft,
      stock_confirmation_freq_days: d.stock_confirmation_freq_days,
      updated_by: ctx.userId, updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("locations").update(data).eq("id", id).eq("tenant_id", ctx.tenantId);

    if (error) throw new Error(error.message);

    await writeAuditLog({ ctx, action: "UPDATE", tableName: "locations", recordId: id, newValues: data });
    revalidatePath("/master-data/locations");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update location." };
  }
}

// ─── Archive Location ─────────────────────────────────────────
export async function archiveLocation(id: string): Promise<LocationFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();
    const { error } = await supabase.from("locations")
      .update({ is_active: false, archived_at: new Date().toISOString(), updated_by: ctx.userId })
      .eq("id", id).eq("tenant_id", ctx.tenantId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ ctx, action: "ARCHIVE", tableName: "locations", recordId: id });
    revalidatePath("/master-data/locations");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to archive location." };
  }
}

// ─── Get Locations ────────────────────────────────────────────
export async function getLocations(includeArchived = false) {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    let query = supabase
      .from("locations")
      .select("id,name,code,location_type,ownership,state,contact_person,contact_phone,capacity_sqft,is_active,created_at")
      .eq("tenant_id", ctx.tenantId)
      .order("name", { ascending: true });

    if (!includeArchived) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (err) {
    console.error("[locations] getLocations error:", err);
    return [];
  }
}
