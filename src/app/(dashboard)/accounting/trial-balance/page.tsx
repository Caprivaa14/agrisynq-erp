import type { Metadata } from "next";
import { Calculator } from "lucide-react";

export const metadata: Metadata = {
  title: "Trial Balance — AgriSynq ERP",
};

export default function TrialBalancePage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trial Balance</h1>
          <p className="page-subtitle">Statutory trial balance and account summaries</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <Calculator className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 6</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">View the statutory trial balance for any period. Memo ledger accounts are excluded from statutory reports. Drill down to individual voucher lines.</p>
        </div>
      </div>
    </div>
  );
}
