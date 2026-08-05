import type { Metadata } from "next";
import { ShoppingCart } from "lucide-react";

export const metadata: Metadata = {
  title: "GST Purchase Register — AgriSynq ERP",
};

export default function GstPurchaseRegisterPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">GST Purchase Register</h1>
          <p className="page-subtitle">Inward supplies and ITC register</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <ShoppingCart className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 7</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">GST purchase register with ITC eligibility tracking. Composition and unregistered supplier purchases are flagged appropriately.</p>
        </div>
      </div>
    </div>
  );
}
