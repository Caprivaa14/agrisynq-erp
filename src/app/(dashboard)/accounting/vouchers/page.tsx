import type { Metadata } from "next";
import { ScrollText } from "lucide-react";

export const metadata: Metadata = {
  title: "Vouchers — AgriSynq ERP",
};

export default function VouchersPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vouchers</h1>
          <p className="page-subtitle">Immutable double-entry journal entries</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <ScrollText className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 6</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">View all posted vouchers. Every voucher is immutable with balanced debit and credit entries. Sales, purchase, receipt, payment, journal, and contra vouchers.</p>
        </div>
      </div>
    </div>
  );
}
