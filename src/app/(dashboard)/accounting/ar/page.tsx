import type { Metadata } from "next";
import { Building2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Accounts Receivable — AgriSynq ERP",
};

export default function AccountsReceivablePage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts Receivable</h1>
          <p className="page-subtitle">Customer balances, ageing, and statements</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <Building2 className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 6</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Full AR register with credit days tracking, overdue alerts, and ageing buckets (0–30, 31–60, 61–90, 90+ days). Generate customer account statements.</p>
        </div>
      </div>
    </div>
  );
}
