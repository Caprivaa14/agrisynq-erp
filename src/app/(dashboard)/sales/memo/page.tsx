import type { Metadata } from "next";
import { FilePlus2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Memo Sales — AgriSynq ERP",
};

export default function SalesMemoPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Memo Sales</h1>
          <p className="page-subtitle">Internal estimates and informal cash memos</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <FilePlus2 className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 5</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Create informal estimates and cash memos for unregistered buyers. These are strictly isolated to the Memo Ledger and never touch GST registers or the statutory general ledger.</p>
        </div>
      </div>
    </div>
  );
}
