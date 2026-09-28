"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Package, Warehouse, AlertTriangle, BarChart3 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getStockLedger } from "@/actions/stock-ledger";

type BalanceRow = {
  product_id: string;
  products: { name: string; product_code: string | null; unit_of_measure: string } | null;
  location_id: string | null;
  locations: { name: string; code: string | null } | null;
  batch_id: string | null;
  batch_register: { batch_number: string; expiry_date: string | null } | null;
  balance_qty: number;
  last_movement_date: string | null;
};

type LedgerEntry = {
  id: string;
  movement_type: string;
  movement_date: string;
  products: { name: string; product_code: string | null } | null;
  batch_register: { batch_number: string } | null;
  to_location: { name: string } | null;
  from_location: { name: string } | null;
  qty: number;
  unit_of_measure: string;
  rate_per_unit: number;
  taxable_amount: number;
  narration: string | null;
  source_document_no: string | null;
  is_reversal: boolean;
};

const MOVEMENT_BADGE: Record<string, string> = {
  GRN:               "badge-success",
  OPENING:           "badge-info",
  RETURN_FROM_SALE:  "badge-warning",
  TRANSFER_IN:       "badge-info",
  SALE:              "badge-danger",
  RETURN_TO_SUPPLIER:"badge-warning",
  TRANSFER_OUT:      "badge",
  ADJ_INCREASE:      "badge-success",
  ADJ_DECREASE:      "badge-danger",
  EXPIRY_WRITE_OFF:  "badge-danger",
  DAMAGE_WRITE_OFF:  "badge-danger",
  FMS_SUBSIDY_OUT:   "badge",
};

const OUTBOUND = new Set(["SALE","RETURN_TO_SUPPLIER","TRANSFER_OUT","QUARANTINE_HOLD","ADJ_DECREASE","EXPIRY_WRITE_OFF","DAMAGE_WRITE_OFF","FMS_SUBSIDY_OUT"]);

export default function StockLedgerClient({ initialBalance }: { initialBalance: BalanceRow[] }) {
  const router = useRouter();
  const [search, setSearch]             = useState("");
  const [selectedProduct, setSelected]  = useState<BalanceRow | null>(null);
  const [ledgerEntries, setLedger]      = useState<LedgerEntry[]>([]);
  const [loadingLedger, setLoading]     = useState(false);

  // Group balance rows by product for summary table
  const productSummary = Object.values(
    (initialBalance ?? []).reduce<Record<string, {
      product_id: string;
      product_name: string;
      product_code: string | null;
      uom: string;
      total_qty: number;
      locations: string[];
    }>>((acc, row) => {
      const pid = row.product_id;
      if (!acc[pid]) {
        acc[pid] = {
          product_id: row.product_id,
          product_name: row.products?.name ?? "—",
          product_code: row.products?.product_code ?? null,
          uom: row.products?.unit_of_measure ?? "—",
          total_qty: 0,
          locations: [],
        };
      }
      acc[pid].total_qty += Number(row.balance_qty);
      const locName = row.locations?.name ?? "Unknown";
      if (!acc[pid].locations.includes(locName)) acc[pid].locations.push(locName);
      return acc;
    }, {})
  );

  const filtered = productSummary.filter((p) => {
    const q = search.toLowerCase();
    return p.product_name.toLowerCase().includes(q) || (p.product_code ?? "").toLowerCase().includes(q);
  });

  const loadLedger = async (productId: string) => {
    setLoading(true);
    try {
      const entries = (await getStockLedger({ productId, limit: 100 })) as unknown as LedgerEntry[];
      setLedger(entries);
    } catch { setLedger([]); }
    setLoading(false);
  };

  const handleRowClick = async (row: typeof productSummary[0]) => {
    const balRow = initialBalance.find((b) => b.product_id === row.product_id);
    setSelected(balRow ?? null);
    await loadLedger(row.product_id);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Ledger</h1>
          <p className="page-subtitle">Real-time stock balance by product and location</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge-success text-sm">{productSummary.length} products with stock</span>
        </div>
      </div>

      {/* Summary table */}
      {!selectedProduct ? (
        <>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product name or code…"
                className="w-full pl-9 pr-4 py-2 bg-white border border-surface-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20 shadow-sm" />
            </div>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface-subtle text-ink-muted font-medium border-b border-surface-border">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Total Stock</th>
                  <th className="px-4 py-3">UoM</th>
                  <th className="px-4 py-3">Locations</th>
                  <th className="px-4 py-3 text-right">View Ledger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <Package className="w-10 h-10 text-ink-faint mx-auto mb-2" strokeWidth={1.5} />
                      <p className="text-ink-muted text-sm">{search ? "No products match your search." : "No stock entries yet — add opening stock via Batch Register."}</p>
                    </td>
                  </tr>
                ) : filtered.map((p) => (
                  <tr key={p.product_id} className="hover:bg-surface-subtle/50 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(p)}>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">{p.product_code ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-ink">{p.product_name}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">{p.total_qty.toLocaleString("en-IN", { maximumFractionDigits: 3 })}</td>
                    <td className="px-4 py-3 text-ink-muted">{p.uom}</td>
                    <td className="px-4 py-3 text-xs text-ink-muted">{p.locations.slice(0,2).join(", ")}{p.locations.length > 2 && ` +${p.locations.length - 2}`}</td>
                    <td className="px-4 py-3 text-right"><span className="text-xs text-navy-700 hover:underline">View →</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Product drill-down: ledger movements */
        <div className="space-y-4">
          <button onClick={() => setSelected(null)} className="text-sm text-navy-700 hover:underline">← Back to all products</button>
          <div className="card p-4 flex items-center gap-4">
            <BarChart3 className="w-8 h-8 text-leaf-600" strokeWidth={1.5} />
            <div>
              <p className="font-semibold text-ink">{selectedProduct.products?.name}</p>
              <p className="text-xs text-ink-muted">Code: {selectedProduct.products?.product_code ?? "—"} · UoM: {selectedProduct.products?.unit_of_measure}</p>
            </div>
          </div>

          {loadingLedger ? (
            <div className="card p-8 text-center text-ink-muted text-sm">Loading ledger…</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-subtle text-ink-muted font-medium border-b border-surface-border">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3">Document</th>
                    <th className="px-4 py-3">Narration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {ledgerEntries.map((e) => {
                    const isOut = OUTBOUND.has(e.movement_type);
                    const loc = isOut ? e.from_location?.name : e.to_location?.name;
                    return (
                      <tr key={e.id} className={`transition-colors ${e.is_reversal ? "bg-amber-50" : "hover:bg-surface-subtle/50"}`}>
                        <td className="px-4 py-2.5 text-xs text-ink-muted whitespace-nowrap">{formatDate(e.movement_date)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`${MOVEMENT_BADGE[e.movement_type] ?? "badge"} text-xs`}>{e.movement_type.replace(/_/g," ")}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{e.batch_register?.batch_number ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-ink-muted">{loc ?? "—"}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${isOut ? "text-danger-600" : "text-leaf-600"}`}>
                          {isOut ? "−" : "+"}{e.qty.toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-ink-muted">
                          {e.rate_per_unit > 0 ? `₹${e.rate_per_unit.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-ink-muted">{e.source_document_no ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-ink-muted max-w-[200px] truncate">{e.narration ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
