import type { Metadata } from "next";
import { Truck, Info } from "lucide-react";

export const metadata: Metadata = { title: "Delivery Challans — Sales" };

export default function DeliveryChallansPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Delivery Challans</h1>
          <p className="page-subtitle">Physical goods movement documents — not a tax invoice</p>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <Info className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold mb-1">Delivery Challan Rules</p>
          <ul className="space-y-1 list-disc list-inside text-amber-700">
            <li>A DC is a <strong>non-tax</strong> document for permitted goods movements</li>
            <li>It <strong>cannot substitute</strong> a tax invoice for a sale — a tax invoice must follow</li>
            <li>Permitted uses: delivery against invoice, stock transfer, job work, consignment, C&F dispatch, sale-on-approval</li>
            <li>Transport details and approximate value are required for E-way bill compliance</li>
          </ul>
        </div>
      </div>

      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[280px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <Truck className="w-10 h-10 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Delivery Challans — Coming in Phase 6</p>
          <p className="text-sm text-ink-muted mt-1 max-w-md">
            Full challan management with 11 movement purposes, vehicle tracking, E-way bill integration,
            and delivery confirmation is planned for Phase 6 (Logistics & Dispatch).
          </p>
          <p className="text-xs text-ink-faint mt-3">
            Migration 025 (schema) is ready. Schema includes: challan_number, purpose, from/to locations,
            vehicle details, LR number, E-way bill fields, line items with batch tracking.
          </p>
        </div>
      </div>
    </div>
  );
}
