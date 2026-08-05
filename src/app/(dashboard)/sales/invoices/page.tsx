import type { Metadata } from "next";
import { ReceiptText } from "lucide-react";

export const metadata: Metadata = {
  title: "Tax Invoices — AgriSynq ERP",
};

export default function SalesInvoicesPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tax Invoices</h1>
          <p className="page-subtitle">GST B2B and B2C statutory tax invoices</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <ReceiptText className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 5</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Generate statutory GST invoices. Tax is auto-calculated from product HSN and customer GST status. Invoices post to financial ledgers and GST registers — not to physical stock.</p>
        </div>
      </div>
    </div>
  );
}
