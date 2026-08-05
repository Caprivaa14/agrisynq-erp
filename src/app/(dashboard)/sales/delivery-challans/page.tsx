import type { Metadata } from "next";
import { Truck } from "lucide-react";

export const metadata: Metadata = {
  title: "Delivery Challans — AgriSynq ERP",
};

export default function DeliveryChallansPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Delivery Challans</h1>
          <p className="page-subtitle">Physical stock movement documents</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <Truck className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 5</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Delivery challans record physical dispatch of goods. Issuance triggers physical stock deduction. Challans can be linked to tax invoices or memo sales.</p>
        </div>
      </div>
    </div>
  );
}
