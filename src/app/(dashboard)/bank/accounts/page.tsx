import type { Metadata } from "next";
import { Building2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Bank Accounts — AgriSynq ERP",
};

export default function BankAccountsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bank Accounts</h1>
          <p className="page-subtitle">Current and savings accounts linked to the GL</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <Building2 className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 7</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Manage bank accounts with GL linkage. Account numbers are encrypted at rest.</p>
        </div>
      </div>
    </div>
  );
}
