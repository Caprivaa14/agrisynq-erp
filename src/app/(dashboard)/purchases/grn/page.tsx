import type { Metadata } from "next";
import { Truck } from "lucide-react";

export const metadata: Metadata = {
  title: "Goods Receipts (GRN) — AgriSynq ERP",
};

export default function GrnPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Goods Receipts (GRN)</h1>
          <p className="page-subtitle">Receive and verify incoming goods</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <Truck className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 3</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Record goods receipt, assign batch numbers, conduct QC verification, and trigger physical stock increase on approval.</p>
        </div>
      </div>
    </div>
  );
}
