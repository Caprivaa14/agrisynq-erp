"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserContext, writeAuditLog } from "./context";

// ─── Zod Schema ───────────────────────────────────────────────
const BatchSchema = z.object({
  batch_number:           z.string().min(1, "Batch number is required").max(100),
  internal_batch_ref:     z.string().max(100).optional().or(z.literal("")),
  product_id:             z.string().uuid("Select a product"),
  supplier_id:            z.string().uuid().optional().or(z.literal("")),
  location_id:            z.string().uuid("Select a location"),
  opening_qty:            z.number().min(0.001, "Quantity must be greater than 0"),
  unit_of_measure:        z.string().min(1, "Unit of measure is required"),
  purchase_rate:          z.number().min(0),
  purchase_rate_with_tax: z.number().min(0),
  landing_cost_per_unit:  z.number().min(0),
  manufacture_date:       z.string().optional().or(z.literal("")),
  expiry_date:            z.string().optional().or(z.literal("")),
  pos_batch_ref:          z.string().max(100).optional().or(z.literal("")),
  fms_batch_code:         z.string().max(100).optional().or(z.literal("")),
  narration:              z.string().max(500).optional().or(z.literal("")),
}).refine(
  (d) => {
    if (!d.expiry_date || !d.manufacture_date) return true;
    return new Date(d.expiry_date) >= new Date(d.manufacture_date);
  },
  { message: "Expiry date must be on or after manufacture date", path: ["expiry_date"] }
);

export type BatchFormState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  batchId?: string;
};

// ─── Add Batch (Opening Stock / GRN) ─────────────────────────
export async function addBatch(
  _prev: BatchFormState,
  formData: FormData
): Promise<BatchFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const opening_qty = Number(formData.get("opening_qty") || 0);
    const purchase_rate = Number(formData.get("purchase_rate") || 0);

    const raw = {
      batch_number:           (formData.get("batch_number") as string)?.trim(),
      internal_batch_ref:     (formData.get("internal_batch_ref") as string) || "",
      product_id:             formData.get("product_id") as string,
      supplier_id:            (formData.get("supplier_id") as string) || "",
      location_id:            formData.get("location_id") as string,
      opening_qty,
      unit_of_measure:        formData.get("unit_of_measure") as string,
      purchase_rate,
      purchase_rate_with_tax: Number(formData.get("purchase_rate_with_tax") || purchase_rate),
      landing_cost_per_unit:  Number(formData.get("landing_cost_per_unit") || purchase_rate),
      manufacture_date:       (formData.get("manufacture_date") as string) || "",
      expiry_date:            (formData.get("expiry_date") as string) || "",
      pos_batch_ref:          (formData.get("pos_batch_ref") as string) || "",
      fms_batch_code:         (formData.get("fms_batch_code") as string) || "",
      narration:              (formData.get("narration") as string) || "",
    };

    const parsed = BatchSchema.safeParse(raw);
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const d = parsed.data;
    const isOpeningStock = formData.get("is_opening_stock") === "true";

    // Check if batch already exists for this product in this org
    const { data: existing } = await supabase
      .from("batch_register")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("organisation_id", ctx.organisationId)
      .eq("product_id", d.product_id)
      .eq("batch_number", d.batch_number)
      .maybeSingle();

    if (existing) {
      return { error: `Batch number "${d.batch_number}" already exists for this product.` };
    }

    const batchData = {
      tenant_id:              ctx.tenantId,
      organisation_id:        ctx.organisationId,
      branch_id:              ctx.branchId,
      batch_number:           d.batch_number,
      internal_batch_ref:     d.internal_batch_ref || null,
      product_id:             d.product_id,
      supplier_id:            d.supplier_id || null,
      location_id:            d.location_id,
      opening_qty:            d.opening_qty,
      current_qty:            d.opening_qty,
      unit_of_measure:        d.unit_of_measure,
      purchase_rate:          d.purchase_rate,
      purchase_rate_with_tax: d.purchase_rate_with_tax,
      landing_cost_per_unit:  d.landing_cost_per_unit,
      manufacture_date:       d.manufacture_date || null,
      expiry_date:            d.expiry_date || null,
      pos_batch_ref:          d.pos_batch_ref || null,
      fms_batch_code:         d.fms_batch_code || null,
      status:                 "OPEN" as const,
      created_by:             ctx.userId,
    };

    const { data: insertedBatch, error: batchError } = await supabase
      .from("batch_register")
      .insert([batchData])
      .select("id")
      .single();

    if (batchError) throw new Error(batchError.message);

    const batchId = insertedBatch?.id;

    // Post to stock_ledger as OPENING or GRN
    const movementType = isOpeningStock ? "OPENING" : "GRN";
    const ledgerEntry = {
      tenant_id:            ctx.tenantId,
      organisation_id:      ctx.organisationId,
      branch_id:            ctx.branchId,
      movement_type:        movementType,
      movement_date:        new Date().toISOString().split("T")[0],
      product_id:           d.product_id,
      batch_id:             batchId,
      to_location_id:       d.location_id,
      party_id:             d.supplier_id || null,
      qty:                  d.opening_qty,
      unit_of_measure:      d.unit_of_measure,
      rate_per_unit:        d.purchase_rate,
      gst_amount:           0,
      gst_rate:             0,
      source_document_type: movementType === "OPENING" ? "ADJUSTMENT" : "PURCHASE_INVOICE",
      narration:            d.narration || `${movementType} entry for batch ${d.batch_number}`,
      created_by:           ctx.userId,
    };

    const { error: ledgerError } = await supabase
      .from("stock_ledger")
      .insert([ledgerEntry]);

    if (ledgerError) throw new Error(`Batch saved but ledger entry failed: ${ledgerError.message}`);

    await writeAuditLog({
      ctx, action: "INSERT", tableName: "batch_register", recordId: batchId,
      newValues: { ...batchData, movement_type: movementType },
    });

    revalidatePath("/inventory/batches");
    revalidatePath("/inventory/ledger");
    return { success: true, batchId };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to add batch." };
  }
}

// ─── Update Batch (metadata only — no qty change) ─────────────
export async function updateBatch(
  id: string,
  _prev: BatchFormState,
  formData: FormData
): Promise<BatchFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const data = {
      internal_batch_ref:  (formData.get("internal_batch_ref") as string) || null,
      manufacture_date:    (formData.get("manufacture_date") as string) || null,
      expiry_date:         (formData.get("expiry_date") as string) || null,
      pos_batch_ref:       (formData.get("pos_batch_ref") as string) || null,
      fms_batch_code:      (formData.get("fms_batch_code") as string) || null,
      updated_by:          ctx.userId,
      updated_at:          new Date().toISOString(),
    };

    const { error } = await supabase
      .from("batch_register")
      .update(data)
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId);

    if (error) throw new Error(error.message);

    await writeAuditLog({ ctx, action: "UPDATE", tableName: "batch_register", recordId: id, newValues: data });
    revalidatePath("/inventory/batches");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update batch." };
  }
}

// ─── Quarantine Batch ─────────────────────────────────────────
export async function quarantineBatch(id: string, reason: string): Promise<BatchFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const { data: batch, error: fetchErr } = await supabase
      .from("batch_register")
      .select("id, product_id, location_id, current_qty, unit_of_measure")
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId)
      .single();

    if (fetchErr || !batch) throw new Error("Batch not found.");
    if (batch.current_qty <= 0) throw new Error("Batch has no stock to quarantine.");

    // Move to quarantine in ledger
    const { error: ledgerErr } = await supabase.from("stock_ledger").insert([{
      tenant_id: ctx.tenantId,
      organisation_id: ctx.organisationId,
      branch_id: ctx.branchId,
      movement_type: "QUARANTINE_HOLD",
      movement_date: new Date().toISOString().split("T")[0],
      product_id: batch.product_id,
      batch_id: id,
      from_location_id: batch.location_id,
      to_location_id: batch.location_id,
      qty: batch.current_qty,
      unit_of_measure: batch.unit_of_measure,
      rate_per_unit: 0, gst_amount: 0, gst_rate: 0,
      narration: `Quarantine: ${reason}`,
      created_by: ctx.userId,
    }]);

    if (ledgerErr) throw new Error(ledgerErr.message);

    // Update batch status
    const { error } = await supabase
      .from("batch_register")
      .update({ status: "QUARANTINE", quarantine_reason: reason, quarantine_date: new Date().toISOString().split("T")[0], updated_by: ctx.userId })
      .eq("id", id).eq("tenant_id", ctx.tenantId);

    if (error) throw new Error(error.message);

    await writeAuditLog({ ctx, action: "QUARANTINE", tableName: "batch_register", recordId: id, newValues: { reason } });
    revalidatePath("/inventory/batches");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to quarantine batch." };
  }
}

// ─── Get Batches ──────────────────────────────────────────────
export async function getBatches(filters?: {
  productId?: string;
  locationId?: string;
  status?: string;
  includeEmpty?: boolean;
}) {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    let query = supabase
      .from("batch_register")
      .select(`
        id, batch_number, internal_batch_ref,
        product_id, products(name, product_code, unit_of_measure),
        supplier_id, parties(name),
        location_id, locations(name, code),
        opening_qty, current_qty, unit_of_measure,
        purchase_rate, landing_cost_per_unit,
        manufacture_date, expiry_date,
        status, pos_batch_ref, fms_batch_code,
        received_at, created_at
      `)
      .eq("tenant_id", ctx.tenantId)
      .eq("organisation_id", ctx.organisationId)
      .order("received_at", { ascending: false });

    if (filters?.productId)  query = query.eq("product_id", filters.productId);
    if (filters?.locationId) query = query.eq("location_id", filters.locationId);
    if (filters?.status)     query = query.eq("status", filters.status);
    if (!filters?.includeEmpty) query = query.gt("current_qty", 0);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (err) {
    console.error("[batches] getBatches error:", err);
    return [];
  }
}

// ─── Get Expiring Batches ─────────────────────────────────────
export async function getExpiringBatches(days = 30) {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const { data, error } = await supabase
      .rpc("get_expiring_batches", {
        p_tenant_id:       ctx.tenantId,
        p_organisation_id: ctx.organisationId,
        p_days:            days,
      });

    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (err) {
    console.error("[batches] getExpiringBatches error:", err);
    return [];
  }
}
