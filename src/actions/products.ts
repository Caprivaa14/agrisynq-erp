"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserContext, writeAuditLog } from "./context";

// ─── Zod Schema ───────────────────────────────────────────────
const PRODUCT_CATEGORIES = [
  "FERTILIZER", "PESTICIDE", "SEED", "OTHER",
  "MICRONUTRIENT", "BIO_FERTILIZER", "PLANT_GROWTH",
  "WEEDICIDE", "FUNGICIDE", "INSECTICIDE", "RODENTICIDE", "ADJUVANT"
] as const;

const ProductSchema = z.object({
  // Identity
  name:               z.string().min(1, "Product name is required").max(200),
  product_code:       z.string().max(30).optional().or(z.literal("")),
  brand:              z.string().max(100).optional().or(z.literal("")),
  manufacturer:       z.string().max(200).optional().or(z.literal("")),
  category:           z.enum(PRODUCT_CATEGORIES),
  subcategory:        z.string().max(100).optional().or(z.literal("")),

  // Tax
  hsn_code:           z.string().min(4).max(8).regex(/^\d{4,8}$/, "HSN: 4–8 digits"),
  unit_of_measure:    z.string().min(1, "UoM is required").max(20),
  gst_rate:           z.number().min(0).max(100),
  tax_status:         z.enum(["TAXABLE","EXEMPT","NIL_RATED","NON_GST"]).default("TAXABLE"),
  cess_rate:          z.number().min(0).max(100).default(0),

  // Pricing
  mrp:                z.number().min(0).optional().nullable(),
  selling_price:      z.number().min(0).optional().nullable(),
  purchase_price:     z.number().min(0).optional().nullable(),
  min_selling_rate:   z.number().min(0).optional().nullable(),
  max_discount_pct:   z.number().min(0).max(100).default(0),

  // Packing
  pack_size:          z.number().min(0).optional().nullable(),
  pack_uom:           z.string().max(20).optional().or(z.literal("")),
  alt_uom:            z.string().max(20).optional().or(z.literal("")),
  uom_conversion:     z.number().min(0).optional().nullable(),

  // Inventory controls
  batch_required:     z.boolean().default(false),
  expiry_required:    z.boolean().default(false),
  reorder_level:      z.number().min(0).default(0),
  storage_requirements: z.string().max(500).optional().or(z.literal("")),
  licence_controlled: z.boolean().default(false),

  // Sub-type extensions (stored as JSONB)
  fertilizer_ext:     z.record(z.unknown()).optional().nullable(),
  seed_ext:           z.record(z.unknown()).optional().nullable(),
  pesticide_ext:      z.record(z.unknown()).optional().nullable(),

  // FMS
  fms_product_code:   z.string().max(50).optional().or(z.literal("")),
});

export type ProductFormState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// ─── Add Product ──────────────────────────────────────────────
export async function addProduct(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    // Parse fertilizer_ext JSONB if sent
    let fertilizer_ext = null;
    let seed_ext = null;
    let pesticide_ext = null;
    try {
      const fe = formData.get("fertilizer_ext") as string;
      const se = formData.get("seed_ext") as string;
      const pe = formData.get("pesticide_ext") as string;
      if (fe) fertilizer_ext = JSON.parse(fe);
      if (se) seed_ext = JSON.parse(se);
      if (pe) pesticide_ext = JSON.parse(pe);
    } catch { /* invalid JSON — ignore */ }

    const raw = {
      name:               formData.get("name") as string,
      product_code:       (formData.get("product_code") as string) || "",
      brand:              (formData.get("brand") as string) || "",
      manufacturer:       (formData.get("manufacturer") as string) || "",
      category:           formData.get("category") as string,
      subcategory:        (formData.get("subcategory") as string) || "",
      hsn_code:           formData.get("hsn_code") as string,
      unit_of_measure:    formData.get("unit_of_measure") as string,
      gst_rate:           Number(formData.get("gst_rate") || 0),
      tax_status:         (formData.get("tax_status") as string) || "TAXABLE",
      cess_rate:          Number(formData.get("cess_rate") || 0),
      mrp:                formData.get("mrp") ? Number(formData.get("mrp")) : null,
      selling_price:      formData.get("selling_price") ? Number(formData.get("selling_price")) : null,
      purchase_price:     formData.get("purchase_price") ? Number(formData.get("purchase_price")) : null,
      min_selling_rate:   formData.get("min_selling_rate") ? Number(formData.get("min_selling_rate")) : null,
      max_discount_pct:   Number(formData.get("max_discount_pct") || 0),
      pack_size:          formData.get("pack_size") ? Number(formData.get("pack_size")) : null,
      pack_uom:           (formData.get("pack_uom") as string) || "",
      alt_uom:            (formData.get("alt_uom") as string) || "",
      uom_conversion:     formData.get("uom_conversion") ? Number(formData.get("uom_conversion")) : null,
      batch_required:     formData.get("batch_required") === "true",
      expiry_required:    formData.get("expiry_required") === "true",
      reorder_level:      Number(formData.get("reorder_level") || 0),
      storage_requirements: (formData.get("storage_requirements") as string) || "",
      licence_controlled: formData.get("licence_controlled") === "true",
      fertilizer_ext,
      seed_ext,
      pesticide_ext,
      fms_product_code:   (formData.get("fms_product_code") as string) || "",
    };

    const parsed = ProductSchema.safeParse(raw);
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const d = parsed.data;
    const data = {
      tenant_id: ctx.tenantId,
      organisation_id: ctx.organisationId,
      name: d.name,
      product_code: d.product_code || null,
      brand: d.brand || null,
      manufacturer: d.manufacturer || null,
      category: d.category,
      subcategory: d.subcategory || null,
      hsn_code: d.hsn_code,
      unit_of_measure: d.unit_of_measure,
      gst_rate: d.gst_rate,
      tax_status: d.tax_status,
      cess_rate: d.cess_rate,
      mrp: d.mrp,
      selling_price: d.selling_price,
      purchase_price: d.purchase_price,
      min_selling_rate: d.min_selling_rate,
      max_discount_pct: d.max_discount_pct,
      pack_size: d.pack_size,
      pack_uom: d.pack_uom || null,
      alt_uom: d.alt_uom || null,
      uom_conversion: d.uom_conversion,
      batch_required: d.batch_required,
      expiry_required: d.expiry_required,
      reorder_level: d.reorder_level,
      storage_requirements: d.storage_requirements || null,
      licence_controlled: d.licence_controlled,
      fertilizer_ext: d.fertilizer_ext,
      seed_ext: d.seed_ext,
      pesticide_ext: d.pesticide_ext,
      fms_product_code: d.fms_product_code || null,
      created_by: ctx.userId,
    };

    const { data: inserted, error } = await supabase
      .from("products").insert([data]).select("id").single();

    if (error) throw new Error(error.message);

    await writeAuditLog({ ctx, action: "INSERT", tableName: "products", recordId: inserted?.id, newValues: data });
    revalidatePath("/master-data/products");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to add product." };
  }
}

// ─── Update Product ───────────────────────────────────────────
export async function updateProduct(
  id: string,
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    let fertilizer_ext = null;
    let seed_ext = null;
    let pesticide_ext = null;
    try {
      const fe = formData.get("fertilizer_ext") as string;
      const se = formData.get("seed_ext") as string;
      const pe = formData.get("pesticide_ext") as string;
      if (fe) fertilizer_ext = JSON.parse(fe);
      if (se) seed_ext = JSON.parse(se);
      if (pe) pesticide_ext = JSON.parse(pe);
    } catch { /* ignore */ }

    const raw = {
      name:               formData.get("name") as string,
      product_code:       (formData.get("product_code") as string) || "",
      brand:              (formData.get("brand") as string) || "",
      manufacturer:       (formData.get("manufacturer") as string) || "",
      category:           formData.get("category") as string,
      subcategory:        (formData.get("subcategory") as string) || "",
      hsn_code:           formData.get("hsn_code") as string,
      unit_of_measure:    formData.get("unit_of_measure") as string,
      gst_rate:           Number(formData.get("gst_rate") || 0),
      tax_status:         (formData.get("tax_status") as string) || "TAXABLE",
      cess_rate:          Number(formData.get("cess_rate") || 0),
      mrp:                formData.get("mrp") ? Number(formData.get("mrp")) : null,
      selling_price:      formData.get("selling_price") ? Number(formData.get("selling_price")) : null,
      purchase_price:     formData.get("purchase_price") ? Number(formData.get("purchase_price")) : null,
      min_selling_rate:   formData.get("min_selling_rate") ? Number(formData.get("min_selling_rate")) : null,
      max_discount_pct:   Number(formData.get("max_discount_pct") || 0),
      pack_size:          formData.get("pack_size") ? Number(formData.get("pack_size")) : null,
      pack_uom:           (formData.get("pack_uom") as string) || "",
      alt_uom:            (formData.get("alt_uom") as string) || "",
      uom_conversion:     formData.get("uom_conversion") ? Number(formData.get("uom_conversion")) : null,
      batch_required:     formData.get("batch_required") === "true",
      expiry_required:    formData.get("expiry_required") === "true",
      reorder_level:      Number(formData.get("reorder_level") || 0),
      storage_requirements: (formData.get("storage_requirements") as string) || "",
      licence_controlled: formData.get("licence_controlled") === "true",
      fertilizer_ext,
      seed_ext,
      pesticide_ext,
      fms_product_code:   (formData.get("fms_product_code") as string) || "",
    };

    const parsed = ProductSchema.safeParse(raw);
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const d = parsed.data;
    const data = {
      name: d.name, product_code: d.product_code || null,
      brand: d.brand || null, manufacturer: d.manufacturer || null,
      category: d.category, subcategory: d.subcategory || null,
      hsn_code: d.hsn_code, unit_of_measure: d.unit_of_measure,
      gst_rate: d.gst_rate, tax_status: d.tax_status, cess_rate: d.cess_rate,
      mrp: d.mrp, selling_price: d.selling_price, purchase_price: d.purchase_price,
      min_selling_rate: d.min_selling_rate, max_discount_pct: d.max_discount_pct,
      pack_size: d.pack_size, pack_uom: d.pack_uom || null,
      alt_uom: d.alt_uom || null, uom_conversion: d.uom_conversion,
      batch_required: d.batch_required, expiry_required: d.expiry_required,
      reorder_level: d.reorder_level, storage_requirements: d.storage_requirements || null,
      licence_controlled: d.licence_controlled,
      fertilizer_ext: d.fertilizer_ext, seed_ext: d.seed_ext, pesticide_ext: d.pesticide_ext,
      fms_product_code: d.fms_product_code || null,
      updated_by: ctx.userId, updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("products").update(data).eq("id", id).eq("tenant_id", ctx.tenantId);

    if (error) throw new Error(error.message);

    await writeAuditLog({ ctx, action: "UPDATE", tableName: "products", recordId: id, newValues: data });
    revalidatePath("/master-data/products");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update product." };
  }
}

// ─── Archive / Restore ────────────────────────────────────────
export async function archiveProduct(id: string): Promise<ProductFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();
    const { error } = await supabase.from("products")
      .update({ is_active: false, archived_at: new Date().toISOString(), updated_by: ctx.userId })
      .eq("id", id).eq("tenant_id", ctx.tenantId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ ctx, action: "ARCHIVE", tableName: "products", recordId: id });
    revalidatePath("/master-data/products");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to archive product." };
  }
}

export async function restoreProduct(id: string): Promise<ProductFormState> {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();
    const { error } = await supabase.from("products")
      .update({ is_active: true, archived_at: null, updated_by: ctx.userId })
      .eq("id", id).eq("tenant_id", ctx.tenantId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ ctx, action: "RESTORE", tableName: "products", recordId: id });
    revalidatePath("/master-data/products");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to restore product." };
  }
}

// ─── Get Products ─────────────────────────────────────────────
export async function getProducts(includeArchived = false) {
  try {
    const supabase = createClient();
    const ctx = await getUserContext();

    let query = supabase
      .from("products")
      .select("id,name,product_code,brand,category,hsn_code,unit_of_measure,gst_rate,tax_status,mrp,selling_price,batch_required,expiry_required,licence_controlled,is_active,created_at")
      .eq("tenant_id", ctx.tenantId)
      .order("name", { ascending: true });

    if (!includeArchived) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (err) {
    console.error("[products] getProducts error:", err);
    return [];
  }
}
