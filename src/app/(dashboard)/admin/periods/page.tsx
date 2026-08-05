import type { Metadata } from "next";
import { FileCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Period Locks — AgriSynq ERP",
};

export default function PeriodsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Period Locks</h1>
          <p className="page-subtitle">Financial, GST, and FMS period locking</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <FileCheck className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 10</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Lock financial years, GST periods, and FMS claim periods to prevent retroactive modifications to posted transactions.</p>
        </div>
      </div>
    </div>
  );
}
