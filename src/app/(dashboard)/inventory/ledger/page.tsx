import type { Metadata } from "next";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "Stock Ledger — AgriSynq ERP",
};

export default function StockLedgerPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Ledger</h1>
          <p className="page-subtitle">Immutable physical and accounting stock register</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <BookOpen className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 4</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">View the complete append-only stock ledger with every receipt, dispatch, transfer, and adjustment. Filter by product, batch, location, and date range.</p>
        </div>
      </div>
    </div>
  );
}
