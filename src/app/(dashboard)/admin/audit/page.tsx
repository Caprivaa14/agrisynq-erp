import type { Metadata } from "next";
import { FileSearch } from "lucide-react";

export const metadata: Metadata = {
  title: "Audit Log — AgriSynq ERP",
};

export default function AuditPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Immutable record of every system action</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <FileSearch className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 10</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">View the complete audit trail of all data-modifying operations with user, role, action, old/new values, reason, and timestamp.</p>
        </div>
      </div>
    </div>
  );
}
