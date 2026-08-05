import type { Metadata } from "next";
import { FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "GSTR-1 — AgriSynq ERP",
};

export default function Gstr1Page() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">GSTR-1</h1>
          <p className="page-subtitle">Monthly outward supply return</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <FileText className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 7</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Generate GSTR-1 data with B2B summary, B2C summary, HSN summary, and credit/debit note details for the selected GST period.</p>
        </div>
      </div>
    </div>
  );
}
