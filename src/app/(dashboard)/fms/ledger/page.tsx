import type { Metadata } from "next";
import { ScrollText } from "lucide-react";

export const metadata: Metadata = {
  title: "FMS Ledger — AgriSynq ERP",
};

export default function FmsLedgerPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">FMS Ledger</h1>
          <p className="page-subtitle">Farmer sales filtered for FMS/iFMS portal reconciliation</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <ScrollText className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 8</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Government-portal-ready view of all FMS-linked farmer sales. Supports alias reference display for re-uploaded invoices and exports in reconciliation format.</p>
        </div>
      </div>
    </div>
  );
}
