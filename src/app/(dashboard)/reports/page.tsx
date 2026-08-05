import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

export const metadata: Metadata = {
  title: "Reports — AgriSynq ERP",
};

export default function ReportsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Statutory, operational, and compliance reports</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <BarChart3 className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 9</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">All inventory, sales, purchase, accounts, GST, FMS, and agriculture/fertilizer reports with server-side pagination, filtering, and PDF/Excel export.</p>
        </div>
      </div>
    </div>
  );
}
