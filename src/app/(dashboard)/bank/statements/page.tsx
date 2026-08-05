import type { Metadata } from "next";
import { FileSearch } from "lucide-react";

export const metadata: Metadata = {
  title: "Bank Statements — AgriSynq ERP",
};

export default function BankStatementsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bank Statements</h1>
          <p className="page-subtitle">Import and review bank transaction data</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <FileSearch className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 7</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Import bank statements in CSV format. View imported transactions and their matching status before reconciliation.</p>
        </div>
      </div>
    </div>
  );
}
