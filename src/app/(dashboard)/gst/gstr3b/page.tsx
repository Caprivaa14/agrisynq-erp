import type { Metadata } from "next";
import { FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "GSTR-3B — AgriSynq ERP",
};

export default function Gstr3bPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">GSTR-3B</h1>
          <p className="page-subtitle">Monthly summary return</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <FileText className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 7</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Generate GSTR-3B summary with outward supplies, inward supplies, ITC claims, and net tax payable for the selected GST period.</p>
        </div>
      </div>
    </div>
  );
}
