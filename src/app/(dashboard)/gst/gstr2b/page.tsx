import type { Metadata } from "next";
import { RefreshCcw } from "lucide-react";

export const metadata: Metadata = {
  title: "GSTR-2B Reconciliation — AgriSynq ERP",
};

export default function Gstr2bPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">GSTR-2B Reconciliation</h1>
          <p className="page-subtitle">Match purchase register with government data</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <RefreshCcw className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 7</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Import GSTR-2B data and reconcile against the ERP purchase register. View matched, mismatched, and unmatched entries. ITC decisions remain with the accountant.</p>
        </div>
      </div>
    </div>
  );
}
