import type { Metadata } from "next";
import { RefreshCcw } from "lucide-react";

export const metadata: Metadata = {
  title: "FMS Reconciliation — AgriSynq ERP",
};

export default function FmsReconciliationPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">FMS Reconciliation</h1>
          <p className="page-subtitle">Match ERP records with FMS portal data</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <RefreshCcw className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 8</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">View reconciliation results with matched, probable match, and unmatched entries. Exceptions are logged in the Exception Register. No auto-correction of invoices or stock.</p>
        </div>
      </div>
    </div>
  );
}
