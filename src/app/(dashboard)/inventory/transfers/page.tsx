import type { Metadata } from "next";
import { ArrowLeftRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Stock Transfers — AgriSynq ERP",
};

export default function StockTransfersPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Transfers</h1>
          <p className="page-subtitle">Warehouse-to-warehouse and C&amp;F transfers</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <ArrowLeftRight className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 4</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Transfer stock between own warehouses or from C&amp;F to own warehouse. Transfers require approval and generate a complete audit trail of in-transit quantities.</p>
        </div>
      </div>
    </div>
  );
}
