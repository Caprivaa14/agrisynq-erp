import type { Metadata } from "next";
import { ShoppingCart } from "lucide-react";

export const metadata: Metadata = {
  title: "Sales Orders — AgriSynq ERP",
};

export default function SalesOrdersPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Orders</h1>
          <p className="page-subtitle">Order management, stock reservation, and allocation</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <ShoppingCart className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 5</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Create sales orders with licence validation and stock reservation. Track ordered, reserved, invoiced, and dispatched quantities per line item.</p>
        </div>
      </div>
    </div>
  );
}
