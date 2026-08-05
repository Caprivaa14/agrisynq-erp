import type { Metadata } from "next";
import { FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Credit & Debit Notes — AgriSynq ERP",
};

export default function CreditNotesPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Credit &amp; Debit Notes</h1>
          <p className="page-subtitle">Sales returns, credit notes, and debit notes</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <FileText className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 5</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Issue credit notes for valid sales returns and debit notes for purchase price differences. Original invoices are preserved with a permanent return linkage.</p>
        </div>
      </div>
    </div>
  );
}
