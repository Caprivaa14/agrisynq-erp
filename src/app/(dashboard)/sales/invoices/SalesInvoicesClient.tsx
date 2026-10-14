"use client";

import { useState, useTransition, useMemo } from "react";
import { ReceiptText, Plus, CheckCircle, AlertTriangle, Users, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createSalesInvoice, postSalesInvoice } from "@/actions/sales-invoices";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

/* ── types ── */
type Invoice = {
  id: string; invoice_number: string; invoice_date: string;
  invoice_type: string; sale_type: string; status: string;
  customer_name: string | null; customer_gstin: string | null;
  parties: { name: string } | null;
  locations: { name: string; code: string } | null;
  is_interstate: boolean; place_of_supply: string | null;
  taxable_amount: number; cgst_amount: number; sgst_amount: number;
  igst_amount: number; total_gst_amount: number;
  other_charges: number; net_receivable: number;
  amount_received: number | null; outstanding_amount: number | null;
  due_date: string | null; created_at: string; posted_at: string | null;
};
type Receivable = {
  customer_id: string; customer_name: string; customer_gstin: string | null;
  invoice_count: number; total_invoiced: number; total_received: number;
  total_outstanding: number; earliest_due_date: string | null;
};
type LineItem = {
  id: number; product_id: string; description: string; hsn_code: string;
  batch_id: string; batch_number: string; expiry_date: string;
  qty: string; unit_of_measure: string; unit_price: string;
  mrp: string; discount_percent: string; gst_rate: string;
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT: "badge-warning", POSTED: "badge-success", CANCELLED: "badge-danger",
};
const TYPE_CLASS: Record<string, string> = {
  B2B: "badge-info", B2C_LARGE: "badge", B2C_SMALL: "badge", EXPORT: "badge-warning",
  SEZ: "badge-warning", PROFORMA: "badge",
};
const SALE_TYPES = ["CASH","CREDIT","ADVANCE","SUBSIDY","EXCHANGE"];
const GST_RATES = ["0","5","12","18","28"];
const UOM_LIST = ["BAG","KG","LTR","ML","NOS","BOX","TON","MT","QTL","PKT","SET"];

function blankLine(id: number): LineItem {
  return { id, product_id:"", description:"", hsn_code:"", batch_id:"", batch_number:"",
    expiry_date:"", qty:"", unit_of_measure:"BAG", unit_price:"", mrp:"", discount_percent:"0", gst_rate:"0" };
}

export default function SalesInvoicesClient({
  initialInvoices, customerReceivables,
}: {
  initialInvoices: Invoice[];
  customerReceivables: Receivable[];
}) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [tab, setTab] = useState<"invoices"|"receivables">("invoices");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showPanel, setShowPanel] = useState(false);
  const [isInterstate, setIsInterstate] = useState(false);
  const [lines, setLines] = useState<LineItem[]>([blankLine(1)]);
  const [isPending, startTransition] = useTransition();

  /* ── stats ── */
  const postedInvoices = invoices.filter(i => i.status === "POSTED");
  const totalOutstanding = postedInvoices.reduce((s, i) => s + (i.outstanding_amount ?? 0), 0);
  const overdueCount = postedInvoices.filter(i =>
    (i.outstanding_amount ?? 0) > 0 && i.due_date && i.due_date < new Date().toISOString().split("T")[0]
  ).length;

  /* ── filters ── */
  const filtered = useMemo(() => invoices.filter(inv => {
    if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
    if (typeFilter !== "ALL" && inv.invoice_type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (inv.invoice_number?.toLowerCase().includes(s) ||
        (inv.customer_name ?? "").toLowerCase().includes(s) ||
        (inv.parties?.name ?? "").toLowerCase().includes(s) ||
        (inv.customer_gstin ?? "").toLowerCase().includes(s));
    }
    return true;
  }), [invoices, statusFilter, typeFilter, search]);

  /* ── line totals ── */
  const totals = useMemo(() => {
    let taxable = 0, cgst = 0, sgst = 0, igst = 0;
    for (const l of lines) {
      const qty = parseFloat(l.qty) || 0;
      const price = parseFloat(l.unit_price) || 0;
      const disc = parseFloat(l.discount_percent) || 0;
      const rate = parseFloat(l.gst_rate) || 0;
      const t = qty * price * (1 - disc / 100);
      const gstAmt = (t * rate) / 100;
      taxable += t;
      if (isInterstate) igst += gstAmt;
      else { cgst += gstAmt / 2; sgst += gstAmt / 2; }
    }
    return { taxable, cgst, sgst, igst, total: taxable + cgst + sgst + igst };
  }, [lines, isInterstate]);

  /* ── add/remove lines ── */
  const addLine = () => setLines(ls => [...ls, blankLine(ls.length + 1)]);
  const removeLine = (id: number) => setLines(ls => ls.filter(l => l.id !== id));
  const updateLine = (id: number, key: keyof LineItem, val: string) =>
    setLines(ls => ls.map(l => l.id === id ? { ...l, [key]: val } : l));

  /* ── post invoice ── */
  function handlePost(id: string, num: string) {
    if (!confirm(`Post invoice ${num}? This will update stock ledger and cannot be undone.`)) return;
    startTransition(async () => {
      const res = await postSalesInvoice(id);
      if (res.success) {
        toast.success(`Invoice ${num} posted. Stock updated.`);
        setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: "POSTED" } : i));
      } else toast.error(res.error ?? "Failed to post.");
    });
  }

  /* ── create invoice ── */
  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("is_interstate", isInterstate ? "true" : "false");
    fd.set("lines", JSON.stringify(lines.map(l => ({
      product_id: l.product_id, description: l.description, hsn_code: l.hsn_code,
      batch_id: l.batch_id || undefined, batch_number: l.batch_number, expiry_date: l.expiry_date,
      qty: parseFloat(l.qty) || 0, unit_of_measure: l.unit_of_measure,
      unit_price: parseFloat(l.unit_price) || 0, mrp: parseFloat(l.mrp) || undefined,
      discount_percent: parseFloat(l.discount_percent) || 0, gst_rate: parseFloat(l.gst_rate) || 0,
    }))));
    startTransition(async () => {

      const res = await createSalesInvoice(undefined as never, fd);
      if (res.success) {
        toast.success(`Invoice ${res.invoiceNumber} created.`);
        setShowPanel(false);
        setLines([blankLine(1)]);
      } else {
        toast.error(res.error ?? "Failed to create invoice.");
      }
    });
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Tax Invoices</h1>
          <p className="page-subtitle">GST B2B and B2C statutory invoices — tax computed from HSN × customer GST status</p>
        </div>
        <button onClick={() => setShowPanel(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-ink-muted uppercase tracking-wide">Total Invoices</p>
          <p className="text-2xl font-bold text-ink mt-1">{invoices.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-muted uppercase tracking-wide">Posted</p>
          <p className="text-2xl font-bold text-leaf-700 mt-1">{postedInvoices.length}</p>
        </div>
        <div className={cn("card p-4", totalOutstanding > 0 ? "border-red-300 bg-red-50" : "")}>
          <p className="text-xs text-ink-muted uppercase tracking-wide">Total Outstanding</p>
          <p className={cn("text-2xl font-bold mt-1", totalOutstanding > 0 ? "text-red-600" : "text-ink")}>
            {formatCurrency(totalOutstanding)}
          </p>
        </div>
        <div className={cn("card p-4", overdueCount > 0 ? "border-red-300 bg-red-50" : "")}>
          <p className="text-xs text-ink-muted uppercase tracking-wide">Overdue</p>
          <p className={cn("text-2xl font-bold mt-1", overdueCount > 0 ? "text-red-600" : "text-ink")}>
            {overdueCount}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-border">
        {(["invoices","receivables"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors", tab === t
              ? "border-leaf-700 text-leaf-700"
              : "border-transparent text-ink-muted hover:text-ink")}>
            {t === "invoices" ? `Invoices (${invoices.length})` : `Receivables (${customerReceivables.length})`}
          </button>
        ))}
      </div>

      {tab === "invoices" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice, customer, GSTIN…"
              className="border border-surface-border rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-leaf-600" />
            <div className="flex gap-1">
              {["ALL","DRAFT","POSTED","CANCELLED"].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors", statusFilter === s
                    ? "bg-navy-950 text-white border-navy-950"
                    : "border-surface-border text-ink-muted hover:bg-surface-subtle")}>
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {["ALL","B2B","B2C_LARGE","B2C_SMALL","EXPORT"].map(t => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors", typeFilter === t
                    ? "bg-navy-950 text-white border-navy-950"
                    : "border-surface-border text-ink-muted hover:bg-surface-subtle")}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="card p-12 flex flex-col items-center gap-4 text-center">
              <div className="p-4 rounded-2xl bg-surface-subtle"><ReceiptText className="w-8 h-8 text-ink-faint" strokeWidth={1.5} /></div>
              <p className="text-sm text-ink-muted">No invoices found</p>
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Invoice No</th><th>Date</th><th>Type</th><th>Customer</th><th>GSTIN</th>
                    <th>Location</th><th>Taxable</th><th>GST</th><th>Net Receivable</th>
                    <th>Outstanding</th><th>Due</th><th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => {
                    const gstDisplay = inv.is_interstate
                      ? `IGST ${formatCurrency(inv.igst_amount)}`
                      : `CGST ${formatCurrency(inv.cgst_amount)} / SGST ${formatCurrency(inv.sgst_amount)}`;
                    const isOverdue = (inv.outstanding_amount ?? 0) > 0 &&
                      inv.due_date && inv.due_date < new Date().toISOString().split("T")[0];
                    return (
                      <tr key={inv.id}>
                        <td className="font-mono text-leaf-700 text-xs">{inv.invoice_number}</td>
                        <td>{formatDate(inv.invoice_date)}</td>
                        <td><span className={cn("badge text-xs", TYPE_CLASS[inv.invoice_type] ?? "badge")}>{inv.invoice_type}</span></td>
                        <td className="max-w-[160px] truncate">{inv.parties?.name ?? inv.customer_name ?? "—"}</td>
                        <td className="font-mono text-xs text-ink-muted">{inv.customer_gstin ?? "—"}</td>
                        <td className="text-xs text-ink-muted">{inv.locations?.name ?? "—"}</td>
                        <td className="text-right">{formatCurrency(inv.taxable_amount)}</td>
                        <td className="text-right text-xs text-ink-muted">{gstDisplay}</td>
                        <td className="text-right font-medium">{formatCurrency(inv.net_receivable)}</td>
                        <td className={cn("text-right font-medium", (inv.outstanding_amount ?? 0) > 0 ? "text-red-600" : "text-ink-muted")}>
                          {formatCurrency(inv.outstanding_amount ?? 0)}
                        </td>
                        <td className={cn("text-xs", isOverdue ? "text-red-600 font-medium" : "text-ink-muted")}>
                          {inv.due_date ? formatDate(inv.due_date) : "—"}
                        </td>
                        <td><span className={cn("badge text-xs", STATUS_CLASS[inv.status] ?? "badge")}>{inv.status}</span></td>
                        <td>
                          {inv.status === "DRAFT" && (
                            <button onClick={() => handlePost(inv.id, inv.invoice_number)} disabled={isPending}
                              className="text-xs px-2 py-1 bg-leaf-700 text-white rounded hover:bg-leaf-700/90 disabled:opacity-50">
                              Post
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "receivables" && (
        <div className="card overflow-x-auto">
          {customerReceivables.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-4 text-center">
              <Users className="w-8 h-8 text-ink-faint" />
              <p className="text-sm text-ink-muted">No outstanding receivables</p>
            </div>
          ) : (
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th>Customer</th><th>GSTIN</th><th>Invoices</th>
                  <th>Total Invoiced</th><th>Total Received</th><th>Outstanding</th><th>Earliest Due</th>
                </tr>
              </thead>
              <tbody>
                {customerReceivables.map(r => {
                  const isOverdue = r.earliest_due_date && r.earliest_due_date < new Date().toISOString().split("T")[0];
                  return (
                    <tr key={r.customer_id}>
                      <td className="font-medium">{r.customer_name}</td>
                      <td className="font-mono text-xs text-ink-muted">{r.customer_gstin ?? "—"}</td>
                      <td className="text-center">{r.invoice_count}</td>
                      <td className="text-right">{formatCurrency(r.total_invoiced)}</td>
                      <td className="text-right text-leaf-700">{formatCurrency(r.total_received)}</td>
                      <td className={cn("text-right font-semibold", r.total_outstanding > 0 ? "text-red-600" : "")}>
                        {formatCurrency(r.total_outstanding)}
                      </td>
                      <td className={cn("text-xs", isOverdue ? "text-red-600 font-medium" : "text-ink-muted")}>
                        {r.earliest_due_date ? formatDate(r.earliest_due_date) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── New Invoice Slide-over ── */}
      {showPanel && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowPanel(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
              <div>
                <h2 className="text-base font-semibold text-ink">New Tax Invoice</h2>
                <p className="text-xs text-ink-muted">GST type auto-determined from GSTIN + amount</p>
              </div>
              <button onClick={() => setShowPanel(false)} className="text-ink-muted hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Interstate toggle */}
              <div className="flex items-center gap-3 p-3 bg-surface-subtle rounded-lg">
                <input type="checkbox" id="is_interstate" checked={isInterstate}
                  onChange={e => setIsInterstate(e.target.checked)}
                  className="w-4 h-4 accent-leaf-700" />
                <label htmlFor="is_interstate" className="text-sm font-medium text-ink cursor-pointer">
                  Interstate Sale (IGST applies instead of CGST+SGST)
                </label>
              </div>

              {/* Header fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Invoice Date *</label>
                  <input name="invoice_date" type="date" required defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-600" />
                </div>
                <div>
                  <label className="form-label">Sale Type</label>
                  <select name="sale_type" className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-600">
                    {SALE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Customer Name</label>
                  <input name="customer_name" className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-600" />
                </div>
                <div>
                  <label className="form-label">Customer GSTIN</label>
                  <input name="customer_gstin" maxLength={15} placeholder="15-char GSTIN or blank for B2C"
                    className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-leaf-600" />
                </div>
                <div>
                  <label className="form-label">Customer Phone</label>
                  <input name="customer_phone" type="tel"
                    className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-600" />
                </div>
                <div>
                  <label className="form-label">Place of Supply (State Code)</label>
                  <input name="place_of_supply" maxLength={2} placeholder="e.g. 07"
                    className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-leaf-600" />
                </div>
                <div>
                  <label className="form-label">Dispatch Location (UUID) *</label>
                  <input name="from_location" required placeholder="Location UUID"
                    className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-leaf-600" />
                </div>
                <div>
                  <label className="form-label">Payment Terms (days)</label>
                  <input name="payment_terms_days" type="number" min={0} defaultValue={0}
                    className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-600" />
                </div>
                <div>
                  <label className="form-label">Other Charges (₹)</label>
                  <input name="other_charges" type="number" min={0} defaultValue={0} step="0.01"
                    className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-600" />
                </div>
                <div>
                  <label className="form-label">Round Off (₹)</label>
                  <input name="round_off" type="number" defaultValue={0} step="0.01"
                    className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-600" />
                </div>
              </div>
              <div>
                <label className="form-label">Narration</label>
                <textarea name="narration" rows={2}
                  className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-600" />
              </div>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-ink">Line Items</p>
                  <button type="button" onClick={addLine}
                    className="text-xs px-2 py-1 border border-leaf-700 text-leaf-700 rounded hover:bg-leaf-700/10">
                    + Add Row
                  </button>
                </div>
                <div className="space-y-3">
                  {lines.map(l => (
                    <div key={l.id} className="border border-surface-border rounded-lg p-3 bg-surface-subtle space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="form-label text-xs">Product UUID *</label>
                          <input value={l.product_id} onChange={e => updateLine(l.id, "product_id", e.target.value)}
                            placeholder="Product UUID" required
                            className="w-full border border-surface-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-leaf-600" />
                        </div>
                        <div>
                          <label className="form-label text-xs">HSN *</label>
                          <input value={l.hsn_code} onChange={e => updateLine(l.id, "hsn_code", e.target.value)} required
                            className="w-full border border-surface-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-leaf-600" />
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="form-label text-xs">Qty *</label>
                          <input value={l.qty} onChange={e => updateLine(l.id, "qty", e.target.value)}
                            type="number" min={0} step="any" required
                            className="w-full border border-surface-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-leaf-600" />
                        </div>
                        <div>
                          <label className="form-label text-xs">UoM</label>
                          <select value={l.unit_of_measure} onChange={e => updateLine(l.id, "unit_of_measure", e.target.value)}
                            className="w-full border border-surface-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-leaf-600">
                            {UOM_LIST.map(u => <option key={u}>{u}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="form-label text-xs">Unit Price *</label>
                          <input value={l.unit_price} onChange={e => updateLine(l.id, "unit_price", e.target.value)}
                            type="number" min={0} step="any" required
                            className="w-full border border-surface-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-leaf-600" />
                        </div>
                        <div>
                          <label className="form-label text-xs">Disc %</label>
                          <input value={l.discount_percent} onChange={e => updateLine(l.id, "discount_percent", e.target.value)}
                            type="number" min={0} max={100} step="any"
                            className="w-full border border-surface-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-leaf-600" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-2 items-center">
                          <label className="form-label text-xs mb-0">GST%</label>
                          <div className="flex gap-1">
                            {GST_RATES.map(r => (
                              <button key={r} type="button" onClick={() => updateLine(l.id, "gst_rate", r)}
                                className={cn("px-2 py-0.5 text-xs rounded border", l.gst_rate === r
                                  ? "bg-navy-950 text-white border-navy-950"
                                  : "border-surface-border text-ink-muted")}>
                                {r}%
                              </button>
                            ))}
                          </div>
                        </div>
                        {lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(l.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals footer */}
              <div className="bg-surface-subtle rounded-lg p-4 space-y-1 text-sm">
                <div className="flex justify-between text-ink-muted">
                  <span>Taxable Amount</span><span>{formatCurrency(totals.taxable)}</span>
                </div>
                {isInterstate ? (
                  <div className="flex justify-between text-ink-muted">
                    <span>IGST</span><span>{formatCurrency(totals.igst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-ink-muted">
                      <span>CGST</span><span>{formatCurrency(totals.cgst)}</span>
                    </div>
                    <div className="flex justify-between text-ink-muted">
                      <span>SGST</span><span>{formatCurrency(totals.sgst)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-semibold text-ink border-t border-surface-border pt-2 mt-2">
                  <span>Net Receivable (preview)</span><span>{formatCurrency(totals.total)}</span>
                </div>
                <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Final amount is computed server-side from HSN + customer GST status
                </p>
              </div>
            </form>

            <div className="px-6 py-4 border-t border-surface-border flex justify-end gap-3">
              <button type="button" onClick={() => setShowPanel(false)}
                className="btn border border-surface-border text-ink-muted hover:bg-surface-subtle">Cancel</button>
              <button form="inv-form" type="submit" disabled={isPending}
                onClick={(e) => {
                  const form = (e.currentTarget.closest(".flex-col") as HTMLElement)?.querySelector("form");
                  if (form) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
                }}
                className="btn btn-primary flex items-center gap-2 disabled:opacity-50">
                <CheckCircle className="w-4 h-4" />
                {isPending ? "Saving…" : "Create Invoice (Draft)"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
