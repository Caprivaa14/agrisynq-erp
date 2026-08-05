import type { Metadata } from "next";
import { RefreshCcw } from "lucide-react";

export const metadata: Metadata = {
  title: "Bank Reconciliation — AgriSynq ERP",
};

export default function BankReconciliationPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bank Reconciliation</h1>
          <p className="page-subtitle">Match ERP entries with bank statement</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <RefreshCcw className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 7</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Reconcile ERP receipt and payment vouchers against bank statement lines. Lock reconciled periods to prevent retroactive changes.</p>
        </div>
      </div>
    </div>
  );
}
