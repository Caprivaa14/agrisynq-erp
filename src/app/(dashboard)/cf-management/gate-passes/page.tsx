import type { Metadata } from "next";
import { FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Gate Passes — AgriSynq ERP",
};

export default function GatePassesPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Gate Passes</h1>
          <p className="page-subtitle">Physical dispatch authorisations from C&amp;F</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <FileText className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 3</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Gate passes authorise physical dispatch from C&amp;F warehouses. Each gate pass deducts physical stock from the C&amp;F location.</p>
        </div>
      </div>
    </div>
  );
}
