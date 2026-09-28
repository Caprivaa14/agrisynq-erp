"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createStockAdjustment, type StockFormState } from "@/actions/stock-ledger";

const INITIAL: StockFormState = {};

const MOVEMENT_TYPES = [
  { value: "ADJ_INCREASE",    label: "Physical Count — Excess",     description: "Stock found more than records. Adds to balance.", dir: "+" },
  { value: "ADJ_DECREASE",    label: "Physical Count — Shortage",   description: "Stock found less than records. Reduces balance.", dir: "−" },
  { value: "EXPIRY_WRITE_OFF",label: "Expiry Write-off",            description: "Expired stock removed from balance.", dir: "−" },
  { value: "DAMAGE_WRITE_OFF",label: "Damage Write-off",            description: "Damaged/spoiled stock removed from balance.", dir: "−" },
] as const;

export default function AdjustmentsClient() {
  const router = useRouter();
  const [movementType, setMovementType] = useState<string>("ADJ_INCREASE");
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().split("T")[0];

  const selected = MOVEMENT_TYPES.find((t) => t.value === movementType);

  const handleAction = (formData: FormData) => {
    formData.set("movement_type", movementType);
    startTransition(async () => {
      const result = await createStockAdjustment(INITIAL, formData);
      if (result.success) {
        toast.success("Adjustment posted to stock ledger.");
        router.refresh();
      } else if (result.fieldErrors) {
        const errs = Object.values(result.fieldErrors).flat();
        toast.error(errs[0] ?? "Validation error.");
      } else {
        toast.error(result.error ?? "Adjustment failed.");
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Adjustments</h1>
          <p className="page-subtitle">Post physical count corrections, write-offs and damage entries with full audit trail</p>
        </div>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
        <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-700">
          Adjustments are <strong>irreversible</strong> and are audit-logged. Period-locked dates are rejected.
          For returns from customers use <strong>Sales Returns</strong>; for returns to suppliers use <strong>Purchase Returns</strong>.
        </p>
      </div>

      <div className="card p-6 space-y-5">
        {/* Movement type selector */}
        <div>
          <label className="form-label">Adjustment Type *</label>
          <div className="grid grid-cols-2 gap-3 mt-1">
            {MOVEMENT_TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => setMovementType(t.value)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  movementType === t.value
                    ? "border-navy-950 bg-navy-950/5 ring-1 ring-navy-950"
                    : "border-surface-border hover:bg-surface-subtle"
                }`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${t.dir === "+" ? "text-leaf-600" : "text-danger-600"}`}>{t.dir}</span>
                  <span className="text-xs font-medium text-ink">{t.label}</span>
                </div>
                <p className="text-xs text-ink-muted mt-1">{t.description}</p>
              </button>
            ))}
          </div>
          {selected && (
            <p className="text-xs text-ink-faint mt-2">
              Direction: <strong className={selected.dir === "+" ? "text-leaf-600" : "text-danger-600"}>{selected.dir}</strong> {selected.description}
            </p>
          )}
        </div>

        <form action={handleAction} className="space-y-4">
          <div>
            <label className="form-label">Product ID (UUID) *</label>
            <input name="product_id" required placeholder="Product UUID"
              className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
          </div>
          <div>
            <label className="form-label">Batch ID (UUID) *</label>
            <input name="batch_id" required placeholder="Batch UUID from batch register"
              className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
          </div>
          <div>
            <label className="form-label">Location ID (UUID) *</label>
            <input name="location_id" required placeholder="Location UUID"
              className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Adjustment Qty *</label>
              <input type="number" name="adjustment_qty" required min="0.001" step="0.001" placeholder="0.000"
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
            </div>
            <div>
              <label className="form-label">Unit of Measure *</label>
              <input name="unit_of_measure" required placeholder="e.g. MT, KG, BAG"
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Rate per Unit</label>
              <input type="number" name="rate_per_unit" min="0" step="0.01" defaultValue="0"
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
            </div>
            <div>
              <label className="form-label">Movement Date *</label>
              <input type="date" name="movement_date" defaultValue={today} required
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
            </div>
          </div>
          <div>
            <label className="form-label">Narration (mandatory) *</label>
            <textarea name="narration" required rows={2}
              placeholder="e.g. Physical stock count dated 28-Sep-2026 — 5 MT shortage at Warehouse A"
              className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20 resize-none" />
          </div>
          <button type="submit" disabled={isPending}
            className="w-full bg-navy-950 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Post Adjustment
          </button>
        </form>
      </div>
    </div>
  );
}
