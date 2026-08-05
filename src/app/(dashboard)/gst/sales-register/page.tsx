import type { Metadata } from "next";
import { ReceiptText } from "lucide-react";

export const metadata: Metadata = {
  title: "GST Sales Register — AgriSynq ERP",
};

export default function GstSalesRegisterPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">GST Sales Register</h1>
          <p className="page-subtitle">B2B, B2C, and nil-rated outward supplies</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <ReceiptText className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 7</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Complete GST sales register populated automatically from posted tax invoices. Filter by period, supply type, and customer GSTIN.</p>
        </div>
      </div>
    </div>
  );
}
