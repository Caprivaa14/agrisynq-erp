"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserContext, writeAuditLog } from "./context";

// ─── Zod Schemas ──────────────────────────────────────────────
const POLineSchema = z.object({
  product_id:    z.string().uuid("Select a product"),
  description:   z.string().max(500).optional().or(z.literal("")),
  ordered_qty:   z.number().min(0.001, "Quantity must be > 0"),
  unit_of_measure: z.string().min(1, "UoM is required"),
  unit_price:    z.number().min(0, "Price must be ≥ 0"),
  discount_percent: z.number().min(0).max(100).default(0),
  gst_rate:      z.number().min(0).max(28).default(0),
});

const POHeaderSchema = z.object({
  supplier_id:            z.string().uuid("Select a supplier"),
  po_date:                z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  expected_delivery_date: z.string().optional().or(z.literal("")),
  deliver_to_location:    z.string().uuid().optional().or(z.literal("")),
  payment_terms_days:     z.number().int().min(0).max(365).default(0),
  discount_percent:       z.number().min(0).max(100).default(0),
  reference_no:           z.string().max(100).optional().or(z.literal("")),
  narration:              z.string().max(1000).optional().or(z.literal("")),
  terms_and_conditions:   z.string().max(2000).optional().or(z.literal("")),
});

export type POFormState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  poId?: string;
  poNumber?: string;
};

// ─── Create Purchase Order ────────────────────────────────────
export async function createPurchaseOrder(
  _prev: POFormState,
  formData: FormData
): Promise<POFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const rawHeader = {
      supplier_id:            formData.get("supplier_id") as string,
      po_date:                formData.get("po_date") as string,
      expected_delivery_date: (formData.get("expected_delivery_date") as string) || "",
      deliver_to_location:    (formData.get("deliver_to_location") as string) || "",
      payment_terms_days:     Number(formData.get("payment_terms_days") || 0),
      discount_percent:       Number(formData.get("discount_percent") || 0),
      reference_no:           (formData.get("reference_no") as string) || "",
      narration:              (formData.get("narration") as string) || "",
      terms_and_conditions:   (formData.get("terms_and_conditions") as string) || "",
    };

    const parsedHeader = POHeaderSchema.safeParse(rawHeader);
    if (!parsedHeader.success) {
      return { fieldErrors: parsedHeader.error.flatten().fieldErrors };
    }

    // Parse lines from JSON
    const linesJson = formData.get("lines") as string;
    let rawLines: unknown[];
    try { rawLines = JSON.parse(linesJson); }
    catch { return { error: "Invalid line items. Please add at least one product." }; }

    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      return { error: "At least one line item is required." };
    }

    const parsedLines = z.array(POLineSchema).safeParse(rawLines);
    if (!parsedLines.success) {
      return { error: "Line validation failed: " + parsedLines.error.issues[0]?.message };
    }

    const lines = parsedLines.data;
    const h = parsedHeader.data;

    // Generate PO number
    const { data: poNumData } = await supabase.rpc("generate_po_number", {
      p_tenant_id:       ctx.tenantId,
      p_organisation_id: ctx.organisationId,
    });
    const poNumber = poNumData as string;

    // Calculate totals (server-side)
    let totalTaxable = 0;
    let totalGst = 0;
    for (const line of lines) {
      const taxable = line.ordered_qty * line.unit_price * (1 - line.discount_percent / 100);
      const gst = (taxable * line.gst_rate) / 100;
      totalTaxable += taxable;
      totalGst += gst;
    }
    const totalAmount = totalTaxable + totalGst;

    // Insert PO header
    const { data: po, error: poErr } = await supabase
      .from("purchase_orders")
      .insert([{
        tenant_id:              ctx.tenantId,
        organisation_id:        ctx.organisationId,
        branch_id:              ctx.branchId,
        po_number:              poNumber,
        po_date:                h.po_date,
        supplier_id:            h.supplier_id,
        expected_delivery_date: h.expected_delivery_date || null,
        deliver_to_location:    h.deliver_to_location || null,
        payment_terms_days:     h.payment_terms_days,
        discount_percent:       h.discount_percent,
        reference_no:           h.reference_no || null,
        narration:              h.narration || null,
        terms_and_conditions:   h.terms_and_conditions || null,
        total_taxable_amount:   Math.round(totalTaxable * 100) / 100,
        total_gst_amount:       Math.round(totalGst * 100) / 100,
        total_amount:           Math.round(totalAmount * 100) / 100,
        status:                 "DRAFT",
        created_by:             ctx.userId,
      }])
      .select("id, po_number")
      .single();

    if (poErr || !po) throw new Error(poErr?.message ?? "Failed to create PO.");

    // Insert lines
    const lineRows = lines.map((line, i) => {
      const taxable = line.ordered_qty * line.unit_price * (1 - line.discount_percent / 100);
      const gst = (taxable * line.gst_rate) / 100;
      return {
        po_id:           po.id,
        tenant_id:       ctx.tenantId,
        line_no:         i + 1,
        product_id:      line.product_id,
        description:     line.description || null,
        ordered_qty:     line.ordered_qty,
        unit_of_measure: line.unit_of_measure,
        unit_price:      line.unit_price,
        discount_percent: line.discount_percent,
        gst_rate:        line.gst_rate,
        gst_amount:      Math.round(gst * 100) / 100,
        total_amount:    Math.round((taxable + gst) * 100) / 100,
      };
    });

    const { error: lineErr } = await supabase.from("purchase_order_lines").insert(lineRows);
    if (lineErr) throw new Error("PO created but lines failed: " + lineErr.message);

    await writeAuditLog({
      ctx, action: "INSERT", tableName: "purchase_orders",
      recordId: po.id,
      newValues: { po_number: po.po_number, supplier_id: h.supplier_id, total_amount: totalAmount },
    });

    revalidatePath("/purchases/orders");
    return { success: true, poId: po.id, poNumber: po.po_number };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to create purchase order." };
  }
}

// ─── Update PO Status ─────────────────────────────────────────
export async function updatePOStatus(
  poId: string,
  status: "SENT" | "ACKNOWLEDGED" | "CLOSED" | "CANCELLED"
): Promise<POFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const { error } = await supabase
      .from("purchase_orders")
      .update({ status, updated_by: ctx.userId })
      .eq("id", poId)
      .eq("tenant_id", ctx.tenantId)
      .not("status", "in", "(CANCELLED,FULLY_RECEIVED)");

    if (error) throw new Error(error.message);

    await writeAuditLog({ ctx, action: "UPDATE", tableName: "purchase_orders", recordId: poId, newValues: { status } });
    revalidatePath("/purchases/orders");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update PO status." };
  }
}

// ─── Get Purchase Orders ──────────────────────────────────────
export async function getPurchaseOrders(filters?: {
  supplierId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
}) {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    let query = supabase
      .from("purchase_orders")
      .select(`
        id, po_number, po_date, reference_no, status,
        supplier_id, parties(name),
        deliver_to_location, locations(name, code),
        expected_delivery_date,
        total_taxable_amount, total_gst_amount, total_amount,
        payment_terms_days,
        created_at, created_by
      `)
      .eq("tenant_id", ctx.tenantId)
      .eq("organisation_id", ctx.organisationId)
      .eq("is_active", true)
      .order("po_date", { ascending: false })
      .limit(200);

    if (filters?.supplierId) query = query.eq("supplier_id", filters.supplierId);
    if (filters?.status)     query = query.eq("status", filters.status);
    if (filters?.fromDate)   query = query.gte("po_date", filters.fromDate);
    if (filters?.toDate)     query = query.lte("po_date", filters.toDate);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (err) {
    console.error("[purchase-orders] getPurchaseOrders:", err);
    return [];
  }
}

// ─── Get PO with Lines ────────────────────────────────────────
export async function getPurchaseOrderById(poId: string) {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    const { data, error } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        parties(name, gstin, phone),
        purchase_order_lines (
          id, line_no, product_id, description,
          products(name, product_code, hsn_code, unit_of_measure),
          ordered_qty, received_qty, pending_qty, unit_of_measure,
          unit_price, discount_percent, taxable_amount, gst_rate, gst_amount, total_amount,
          is_closed
        )
      `)
      .eq("id", poId)
      .eq("tenant_id", ctx.tenantId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  } catch (err) {
    console.error("[purchase-orders] getPurchaseOrderById:", err);
    return null;
  }
}
