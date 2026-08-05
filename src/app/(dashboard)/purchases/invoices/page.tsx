import type { Metadata } from "next";
import { ReceiptText } from "lucide-react";

export const metadata: Metadata = {
  title: "Purchase Invoices — AgriSynq ERP",
};

export default function PurchaseInvoicesPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Invoices</h1>
          <p className="page-subtitle">Statutory purchase invoices and ITC tracking</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <ReceiptText className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 3</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Post supplier GST invoices linked to GRNs. Tax amounts are auto-calculated from HSN and supplier GST status for accurate ITC entries.</p>
        </div>
      </div>
    </div>
  );
}
