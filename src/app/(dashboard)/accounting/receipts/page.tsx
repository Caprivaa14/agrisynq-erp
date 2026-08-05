import type { Metadata } from "next";
import { CreditCard } from "lucide-react";

export const metadata: Metadata = {
  title: "Receipts — AgriSynq ERP",
};

export default function ReceiptsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Receipts</h1>
          <p className="page-subtitle">Cash, cheque, UPI, and third-party payment receipts</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <CreditCard className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 6</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Record customer receipts across all payment modes including third-party cheques. Each receipt is allocated to specific invoices for clean AR reconciliation.</p>
        </div>
      </div>
    </div>
  );
}
