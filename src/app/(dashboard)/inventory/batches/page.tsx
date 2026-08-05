import type { Metadata } from "next";
import { Package } from "lucide-react";

export const metadata: Metadata = {
  title: "Batch Register — AgriSynq ERP",
};

export default function BatchesPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Batch Register</h1>
          <p className="page-subtitle">Batch tracking, expiry alerts, and provisional batch management</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <Package className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 4</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Manage product batches including manufacturing and expiry dates. Use the Provisional Batch Update utility to swap placeholder batches with confirmed lot numbers after dispatch.</p>
        </div>
      </div>
    </div>
  );
}
