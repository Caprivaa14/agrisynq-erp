import type { Metadata } from "next";
import { Boxes } from "lucide-react";

export const metadata: Metadata = {
  title: "C&F Stock Register — AgriSynq ERP",
};

export default function CfStockPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">C&amp;F Stock Register</h1>
          <p className="page-subtitle">Stock held at C&amp;F locations on your behalf</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <Boxes className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 3</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">View stock legally owned by you but physically held at C&amp;F warehouses. Track by product, batch, and company.</p>
        </div>
      </div>
    </div>
  );
}
