import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Stock Adjustments — AgriSynq ERP",
};

export default function StockAdjustmentsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Adjustments</h1>
          <p className="page-subtitle">Supervised positive and negative stock corrections</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <AlertCircle className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 4</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Positive and negative stock adjustments for physical count discrepancies, transit losses, and weighbridge differences. Dual approval required. No ITC generated.</p>
        </div>
      </div>
    </div>
  );
}
