import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Cancel & Reissue — AgriSynq ERP",
};

export default function FmsReissuePage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cancel &amp; Reissue</h1>
          <p className="page-subtitle">Expired subsidy cancellation and fresh reissue workflow</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <AlertCircle className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 8</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Maker-checker workflow for cancelling expired FMS subsidies and creating linked replacement transactions. Permanent audit trail maintained between old and new references.</p>
        </div>
      </div>
    </div>
  );
}
