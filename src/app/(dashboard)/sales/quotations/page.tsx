import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";

export const metadata: Metadata = {
  title: "Quotations & Pro Forma Invoices — AgriSynq ERP",
};

export default function QuotationsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quotations &amp; Pro Forma Invoices</h1>
          <p className="page-subtitle">Pre-sale estimates and pro forma documents</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <ClipboardList className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 5</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Generate quotations and pro forma invoices for customers. These do not affect stock or accounting ledgers.</p>
        </div>
      </div>
    </div>
  );
}
