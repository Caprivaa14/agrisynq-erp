import type { Metadata } from "next";
import { Package } from "lucide-react";

export const metadata: Metadata = {
  title: "Products — AgriSynq ERP",
};

export default function ProductsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Fertilizers, seeds, pesticides, micronutrients</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <Package className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 2</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Full product master with HSN codes, GST rates, FMS product codes, batch-tracking flags, and pricing rules.</p>
        </div>
      </div>
    </div>
  );
}
