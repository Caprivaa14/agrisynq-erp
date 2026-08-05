import type { Metadata } from "next";
import { PiggyBank } from "lucide-react";

export const metadata: Metadata = {
  title: "Accounts Payable — AgriSynq ERP",
};

export default function AccountsPayablePage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts Payable</h1>
          <p className="page-subtitle">Supplier balances and payment tracking</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <PiggyBank className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 6</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Track all supplier payables from purchase invoice posting through payment. View outstanding balances and generate supplier account statements.</p>
        </div>
      </div>
    </div>
  );
}
