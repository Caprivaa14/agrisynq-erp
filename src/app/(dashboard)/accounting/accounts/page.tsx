import type { Metadata } from "next";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "Chart of Accounts — AgriSynq ERP",
};

export default function ChartOfAccountsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Chart of Accounts</h1>
          <p className="page-subtitle">Statutory and memo account structure</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <BookOpen className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 6</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Manage the full chart of accounts. Statutory accounts feed the trial balance and P&amp;L. Memo accounts are strictly isolated and never cross into statutory reporting.</p>
        </div>
      </div>
    </div>
  );
}
