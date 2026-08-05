import type { Metadata } from "next";
import { Warehouse } from "lucide-react";

export const metadata: Metadata = {
  title: "Warehouses & Locations — AgriSynq ERP",
};

export default function LocationsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Warehouses &amp; Locations</h1>
          <p className="page-subtitle">Own, C&amp;F, depot, quarantine, and virtual locations</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <Warehouse className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 2</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Manage all physical and virtual stock locations including own warehouses, C&amp;F warehouses, company depots, and quarantine zones.</p>
        </div>
      </div>
    </div>
  );
}
