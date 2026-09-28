"use client";
// ProductsClient.tsx — interactive client component for Products master data.
// Slide-over with full product form, category, GST, inventory controls, archive.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Plus, Search, X, Package, Pencil, Archive, Layers, Clock } from "lucide-react";
import {
  addProduct,
  updateProduct,
  archiveProduct,
  type ProductFormState,
} from "@/actions/products";
import { formatCurrency } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────
type Product = {
  id: string;
  name: string;
  product_code: string | null;
  brand: string | null;
  category: string;
  hsn_code: string;
  unit_of_measure: string;
  gst_rate: number;
  tax_status: string;
  mrp: number | null;
  selling_price: number | null;
  batch_required: boolean;
  expiry_required: boolean;
  licence_controlled: boolean;
  is_active: boolean;
  created_at: string;
};

interface Props {
  initialData: Product[];
}

// ─── Constants ─────────────────────────────────────────────────
const PRODUCT_CATEGORIES = [
  "FERTILIZER", "PESTICIDE", "SEED", "OTHER",
  "MICRONUTRIENT", "BIO_FERTILIZER", "PLANT_GROWTH",
  "WEEDICIDE", "FUNGICIDE", "INSECTICIDE", "RODENTICIDE", "ADJUVANT",
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  FERTILIZER:    "badge badge-green",
  PESTICIDE:     "badge badge-red",
  SEED:          "badge badge-gold",
  MICRONUTRIENT: "badge badge-memo",
  BIO_FERTILIZER:"badge badge-green",
  PLANT_GROWTH:  "badge badge-memo",
  WEEDICIDE:     "badge badge-red",
  FUNGICIDE:     "badge badge-red",
  INSECTICIDE:   "badge badge-red",
  RODENTICIDE:   "badge badge-red",
  ADJUVANT:      "badge badge-navy",
  OTHER:         "badge badge-gray",
};

const TAX_COLORS: Record<string, string> = {
  TAXABLE:   "badge badge-green",
  EXEMPT:    "badge badge-gold",
  NIL_RATED: "badge badge-memo",
  NON_GST:   "badge badge-gray",
};

// ─── Toggle Switch ─────────────────────────────────────────────
function Toggle({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between text-sm cursor-pointer select-none">
      <span className="text-ink">{label}</span>
      <div className="flex items-center gap-2">
        <input type="hidden" name={name} value={checked ? "true" : "false"} />
        <button
          type="button"
          onClick={() => onChange(!checked)}
          role="switch"
          aria-checked={checked}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? "bg-leaf-600" : "bg-surface-border"}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
          />
        </button>
      </div>
    </label>
  );
}

// ─── Submit Button ─────────────────────────────────────────────
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary w-full" aria-busy={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

// ─── Slide-over Form ───────────────────────────────────────────
const INIT: ProductFormState = {};

function ProductSlideOver({
  isOpen,
  editItem,
  onClose,
}: {
  isOpen: boolean;
  editItem: Product | null;
  onClose: () => void;
}) {
  const router = useRouter();

  const [batch, setBatch] = useState(false);
  const [expiry, setExpiry] = useState(false);
  const [licenceCtrl, setLicenceCtrl] = useState(false);

  useEffect(() => {
    if (editItem) {
      setBatch(editItem.batch_required);
      setExpiry(editItem.expiry_required);
      setLicenceCtrl(editItem.licence_controlled);
    } else {
      setBatch(false);
      setExpiry(false);
      setLicenceCtrl(false);
    }
  }, [editItem, isOpen]);

  const boundAction = editItem ? updateProduct.bind(null, editItem.id) : addProduct;
  const [state, formAction] = useFormState(boundAction, INIT);

  useEffect(() => {
    if (state.success) {
      toast.success(editItem ? "Product updated" : "Product added");
      router.refresh();
      onClose();
    }
    if (state.error) toast.error(state.error);
  }, [state]);

  const fe = state.fieldErrors ?? {};

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} aria-hidden="true" />
      )}
      <div
        className={`fixed inset-y-0 right-0 w-[480px] bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label={editItem ? "Edit Product" : "Add Product"}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border shrink-0">
          <h2 className="text-base font-semibold text-ink">
            {editItem ? "Edit Product" : "Add Product"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-subtle text-ink-muted" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form action={formAction} className="space-y-4">
            {/* Identity */}
            <div>
              <label className="form-label" htmlFor="pr-name">
                Name <span className="text-danger-600">*</span>
              </label>
              <input
                id="pr-name"
                name="name"
                defaultValue={editItem?.name ?? ""}
                className="input w-full"
                required
                placeholder="e.g. Urea 46% N (50 kg)"
              />
              {fe.name && <p className="form-error">{fe.name[0]}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label" htmlFor="pr-code">Product Code</label>
                <input id="pr-code" name="product_code" defaultValue={editItem?.product_code ?? ""} className="input w-full" />
              </div>
              <div>
                <label className="form-label" htmlFor="pr-brand">Brand</label>
                <input id="pr-brand" name="brand" defaultValue={editItem?.brand ?? ""} className="input w-full" />
              </div>
              <div className="col-span-2">
                <label className="form-label" htmlFor="pr-mfr">Manufacturer</label>
                <input id="pr-mfr" name="manufacturer" className="input w-full" />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="form-label" htmlFor="pr-category">
                Category <span className="text-danger-600">*</span>
              </label>
              <select
                id="pr-category"
                name="category"
                defaultValue={editItem?.category ?? "FERTILIZER"}
                className="input w-full"
                required
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>

            {/* HSN / UoM / GST */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label" htmlFor="pr-hsn">
                  HSN Code <span className="text-danger-600">*</span>
                </label>
                <input
                  id="pr-hsn"
                  name="hsn_code"
                  defaultValue={editItem?.hsn_code ?? ""}
                  className="input w-full font-mono"
                  required
                  placeholder="3102"
                  minLength={4}
                  maxLength={8}
                />
                {fe.hsn_code && <p className="form-error">{fe.hsn_code[0]}</p>}
              </div>
              <div>
                <label className="form-label" htmlFor="pr-uom">
                  Unit of Measure <span className="text-danger-600">*</span>
                </label>
                <input
                  id="pr-uom"
                  name="unit_of_measure"
                  defaultValue={editItem?.unit_of_measure ?? ""}
                  className="input w-full"
                  required
                  placeholder="KG"
                />
                {fe.unit_of_measure && <p className="form-error">{fe.unit_of_measure[0]}</p>}
              </div>
              <div>
                <label className="form-label" htmlFor="pr-gst">
                  GST Rate % <span className="text-danger-600">*</span>
                </label>
                <input
                  id="pr-gst"
                  name="gst_rate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  defaultValue={editItem?.gst_rate ?? 0}
                  className="input w-full"
                  required
                />
                {fe.gst_rate && <p className="form-error">{fe.gst_rate[0]}</p>}
              </div>
              <div>
                <label className="form-label" htmlFor="pr-tax_status">Tax Status</label>
                <select
                  id="pr-tax_status"
                  name="tax_status"
                  defaultValue={editItem?.tax_status ?? "TAXABLE"}
                  className="input w-full"
                >
                  <option value="TAXABLE">Taxable</option>
                  <option value="EXEMPT">Exempt</option>
                  <option value="NIL_RATED">Nil Rated</option>
                  <option value="NON_GST">Non-GST</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="pr-cess">Cess Rate %</label>
                <input id="pr-cess" name="cess_rate" type="number" min={0} defaultValue={0} className="input w-full" />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="form-label" htmlFor="pr-mrp">MRP (₹)</label>
                <input id="pr-mrp" name="mrp" type="number" min={0} step={0.01} defaultValue={editItem?.mrp ?? ""} className="input w-full" />
              </div>
              <div>
                <label className="form-label" htmlFor="pr-sell">Selling Price</label>
                <input id="pr-sell" name="selling_price" type="number" min={0} step={0.01} defaultValue={editItem?.selling_price ?? ""} className="input w-full" />
              </div>
              <div>
                <label className="form-label" htmlFor="pr-pur">Purchase Price</label>
                <input id="pr-pur" name="purchase_price" type="number" min={0} step={0.01} className="input w-full" />
              </div>
            </div>

            {/* Pack */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label" htmlFor="pr-pack_size">Pack Size</label>
                <input id="pr-pack_size" name="pack_size" type="number" min={0} step={0.001} className="input w-full" placeholder="50" />
              </div>
              <div>
                <label className="form-label" htmlFor="pr-pack_uom">Pack UoM</label>
                <input id="pr-pack_uom" name="pack_uom" className="input w-full" placeholder="KG" />
              </div>
            </div>

            {/* Inventory Controls */}
            <div className="space-y-3 rounded-lg border border-surface-border bg-surface-subtle p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Inventory Controls</p>
              <Toggle name="batch_required" label="Batch Tracking Required" checked={batch} onChange={setBatch} />
              <Toggle name="expiry_required" label="Expiry Date Required" checked={expiry} onChange={setExpiry} />
              <Toggle name="licence_controlled" label="Licence Controlled" checked={licenceCtrl} onChange={setLicenceCtrl} />
              <div>
                <label className="form-label" htmlFor="pr-reorder">Reorder Level</label>
                <input id="pr-reorder" name="reorder_level" type="number" min={0} defaultValue={0} className="input w-full" />
              </div>
            </div>

            {/* FMS */}
            <div>
              <label className="form-label" htmlFor="pr-fms">FMS Product Code</label>
              <input id="pr-fms" name="fms_product_code" className="input w-full font-mono" />
            </div>

            <div className="pt-2">
              <SubmitButton label={editItem ? "Update Product" : "Add Product"} />
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── Main Client Component ─────────────────────────────────────
export default function ProductsClient({ initialData }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editItem, setEditItem] = useState<Product | null>(null);

  const openAdd = useCallback(() => { setEditItem(null); setIsOpen(true); }, []);
  const openEdit = useCallback((p: Product) => { setEditItem(p); setIsOpen(true); }, []);
  const closePanel = useCallback(() => setIsOpen(false), []);

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Archive "${name}"?`)) return;
    const res = await archiveProduct(id);
    if (res.success) { toast.success("Product archived"); router.refresh(); }
    else toast.error(res.error ?? "Failed");
  };

  const filtered = initialData.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.product_code ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.brand ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Fertilizers, pesticides, seeds and all traded items</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code or brand…"
          className="w-full pl-9 pr-4 py-2 bg-white border border-surface-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-leaf-500/20 focus:border-leaf-500 placeholder:text-ink-faint shadow-sm"
          aria-label="Search products"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>HSN</th>
                <th>UoM</th>
                <th>GST%</th>
                <th>Tax Status</th>
                <th className="text-right">MRP</th>
                <th>Controls</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <Package className="mx-auto mb-3 h-10 w-10 text-ink-faint" />
                    <p className="text-sm font-medium text-ink">
                      {search ? "No products match your search" : "No products yet"}
                    </p>
                    {!search && (
                      <button onClick={openAdd} className="mt-3 text-xs text-leaf-600 hover:underline">
                        Add your first product
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs text-ink-muted">{p.product_code ?? "—"}</td>
                    <td>
                      <div className="font-medium text-ink">{p.name}</div>
                      {p.brand && <div className="text-xs text-ink-muted">{p.brand}</div>}
                    </td>
                    <td>
                      <span className={CATEGORY_COLORS[p.category] ?? "badge badge-gray"}>
                        {p.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{p.hsn_code}</td>
                    <td className="text-ink-muted">{p.unit_of_measure}</td>
                    <td className="tabular-nums">{p.gst_rate}%</td>
                    <td>
                      <span className={TAX_COLORS[p.tax_status] ?? "badge badge-gray"}>
                        {p.tax_status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="text-right tabular-nums text-ink-muted">
                      {p.mrp != null ? formatCurrency(p.mrp) : "—"}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {p.batch_required && (
                          <span title="Batch Required" className="badge badge-navy">
                            <Layers className="w-3 h-3" />
                          </span>
                        )}
                        {p.expiry_required && (
                          <span title="Expiry Required" className="badge badge-gold">
                            <Clock className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded hover:bg-surface-subtle text-ink-muted hover:text-ink transition-colors"
                          aria-label={`Edit ${p.name}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleArchive(p.id, p.name)}
                          className="p-1.5 rounded hover:bg-danger-50 text-ink-muted hover:text-danger-600 transition-colors"
                          aria-label={`Archive ${p.name}`}
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="border-t border-surface-border px-4 py-3 text-xs text-ink-muted">
            {filtered.length} of {initialData.length} products
          </div>
        )}
      </div>

      <ProductSlideOver isOpen={isOpen} editItem={editItem} onClose={closePanel} />
    </div>
  );
}
