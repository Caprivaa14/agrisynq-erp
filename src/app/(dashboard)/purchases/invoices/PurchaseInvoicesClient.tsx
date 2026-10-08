"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Search, Trash2, Loader2, FileText, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { createPurchaseInvoice, postPurchaseInvoice } from "@/actions/purchase-invoices";
import { formatDate, formatCurrency } from "@/lib/utils";

type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  status: string;
  supplier_invoice_no: string | null;
  parties: { name: string; gstin: string | null } | null;
  locations: { name: string; code: string | null } | null;
  is_interstate: boolean;
  is_reverse_charge: boolean;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  other_charges: number;
  net_payable: number;
  amount_paid: number;
  outstanding_amount: number;
  due_date: string | null;
  posted_at: string | null;
};

type Payable = {
  supplier_id: string;
  supplier_name: string;
  invoice_count: number;
  total_invoiced: number;
  total_paid: number;
  total_outstanding: number;
  earliest_overdue_date: string | null;
};

type InvLine = {
  id: string;
  product_id: string;
  description: string;
  hsn_code: string;
  batch_number: string;
  manufacture_date: string;
  expiry_date: string;
  received_qty: number;
  free_qty: number;
  unit_of_measure: string;
  unit_price: number;
  discount_percent: number;
  gst_rate: number;
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT:     "badge-warning",
  POSTED:    "badge-success",
  CANCELLED: "badge-danger",
};

export default function PurchaseInvoicesClient({
  initialInvoices,
  supplierPayables,
}: {
  initialInvoices: Invoice[];
  supplierPayables: Payable[];
}) {
  const router = useRouter();
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("ALL");
  const [activeTab, setTab]         = useState<"invoices"|"payables">("invoices");
  const [isOpen, setIsOpen]         = useState(false);
  const [isPending, startTransition] = useTransition();
  const [lines, setLines]           = useState<InvLine[]>([]);
  const [isInterstate, setIsInter]  = useState(false);

  const addLine = () => setLines((prev) => [...prev, {
    id: crypto.randomUUID(), product_id: "", description: "", hsn_code: "",
    batch_number: "", manufacture_date: "", expiry_date: "",
    received_qty: 1, free_qty: 0, unit_of_measure: "BAG",
    unit_price: 0, discount_percent: 0, gst_rate: 0,
  }]);
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));
  const updateLine = (id: string, field: keyof InvLine, value: string | number) =>
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));

  // Compute live totals
  const totals = lines.reduce((acc, l) => {
    const gross = l.received_qty * l.unit_price;
    const disc = gross * l.discount_percent / 100;
    const taxable = gross - disc;
    const gstAmt = taxable * l.gst_rate / 100;
    const cgst = isInterstate ? 0 : gstAmt / 2;
    const sgst = isInterstate ? 0 : gstAmt / 2;
    const igst = isInterstate ? gstAmt : 0;
    return {
      taxable: acc.taxable + taxable,
      cgst: acc.cgst + cgst,
      sgst: acc.sgst + sgst,
      igst: acc.igst + igst,
    };
  }, { taxable: 0, cgst: 0, sgst: 0, igst: 0 });

  const filtered = initialInvoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchSearch = inv.invoice_number.toLowerCase().includes(q)
      || (inv.parties?.name ?? "").toLowerCase().includes(q)
      || (inv.supplier_invoice_no ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "ALL" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = (formData: FormData) => {
    if (lines.length === 0) { toast.error("Add at least one product line."); return; }
    const linesPayload = lines.map((l) => ({
      product_id: l.product_id, description: l.description, hsn_code: l.hsn_code,
      batch_number: l.batch_number, manufacture_date: l.manufacture_date, expiry_date: l.expiry_date,
      received_qty: l.received_qty, free_qty: l.free_qty, unit_of_measure: l.unit_of_measure,
      unit_price: l.unit_price, discount_percent: l.discount_percent, gst_rate: l.gst_rate,
    }));
    formData.set("lines", JSON.stringify(linesPayload));
    formData.set("is_interstate", isInterstate ? "true" : "false");

    startTransition(async () => {
      const result = await createPurchaseInvoice({}, formData);
      if (result.success) {
        toast.success(`Invoice ${result.invoiceNumber} created. Review and Post to update stock.`);
        setIsOpen(false); setLines([]);
        router.refresh();
      } else if (result.fieldErrors) {
        toast.error(Object.values(result.fieldErrors).flat()[0] ?? "Validation error.");
      } else {
        toast.error(result.error ?? "Failed.");
      }
    });
  };

  const handlePost = async (invoiceId: string, invoiceNo: string) => {
    const confirmed = window.confirm(
      `POST Invoice ${invoiceNo}?\n\nThis will:\n• Create batch entries\n• Update stock ledger (GRN)\n• Cannot be undone\n\nConfirm to proceed.`
    );
    if (!confirmed) return;
    const res = await postPurchaseInvoice(invoiceId);
    if (res.success) { toast.success(`Invoice ${invoiceNo} posted. Stock updated.`); router.refresh(); }
    else toast.error(res.error ?? "Failed to post.");
  };

  const today = new Date().toISOString().split("T")[0];
  const totalOutstanding = supplierPayables.reduce((s, p) => s + p.total_outstanding, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Invoices</h1>
          <p className="page-subtitle">Supplier invoices with GRN — posting updates stock ledger</p>
        </div>
        <button className="btn btn-primary inline-flex items-center gap-2" onClick={() => setIsOpen(true)}>
          <Plus className="w-4 h-4" />New Purchase Invoice
        </button>
      </div>

      {/* Payables summary strip */}
      {totalOutstanding > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <span className="text-sm text-amber-700">
            Total outstanding payables: <strong>{formatCurrency(totalOutstanding)}</strong>
            {" "}across {supplierPayables.length} supplier{supplierPayables.length > 1 ? "s" : ""}.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-border">
        {[["invoices","Invoices"],["payables","Supplier Payables"]].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t as "invoices"|"payables")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t ? "border-leaf-600 text-leaf-700" : "border-transparent text-ink-muted hover:text-ink"
            }`}>{label}</button>
        ))}
      </div>

      {activeTab === "invoices" ? (
        <>
          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice no., supplier…"
                className="w-full pl-9 pr-4 py-2 bg-white border border-surface-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20 shadow-sm" />
            </div>
            {["ALL","DRAFT","POSTED","CANCELLED"].map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  statusFilter === s ? "bg-navy-950 text-white border-navy-950" : "border-surface-border text-ink-muted hover:bg-surface-subtle"
                }`}>{s === "ALL" ? "All" : s}</button>
            ))}
          </div>

          {/* Invoice Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-subtle text-ink-muted font-medium border-b border-surface-border">
                  <tr>
                    <th className="px-4 py-3">Invoice No.</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Supplier Inv.</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3 text-right">Taxable</th>
                    <th className="px-4 py-3 text-right">GST</th>
                    <th className="px-4 py-3 text-right">Net Payable</th>
                    <th className="px-4 py-3 text-right">Outstanding</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border text-ink">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={12} className="px-4 py-12 text-center">
                      <FileText className="w-10 h-10 text-ink-faint mx-auto mb-2" strokeWidth={1.5} />
                      <p className="text-ink-muted text-sm">{search ? "No invoices match." : "No purchase invoices yet."}</p>
                    </td></tr>
                  ) : filtered.map((inv) => {
                    const gstTotal = inv.cgst_amount + inv.sgst_amount + inv.igst_amount;
                    const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.outstanding_amount > 0;
                    return (
                      <tr key={inv.id} className="hover:bg-surface-subtle/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-leaf-700">{inv.invoice_number}</td>
                        <td className="px-4 py-3 text-xs text-ink-muted whitespace-nowrap">{formatDate(inv.invoice_date)}</td>
                        <td className="px-4 py-3 font-medium text-ink">{inv.parties?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-ink-muted">{inv.supplier_invoice_no ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-ink-muted">{inv.locations?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-xs">{formatCurrency(inv.taxable_amount)}</td>
                        <td className="px-4 py-3 text-right text-xs text-ink-muted">{formatCurrency(gstTotal)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(inv.net_payable)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${inv.outstanding_amount > 0 ? "text-danger-600" : "text-leaf-600"}`}>
                          {formatCurrency(inv.outstanding_amount)}
                        </td>
                        <td className={`px-4 py-3 text-xs whitespace-nowrap ${isOverdue ? "text-danger-600 font-medium" : "text-ink-muted"}`}>
                          {inv.due_date ? formatDate(inv.due_date) : "—"}
                        </td>
                        <td className="px-4 py-3"><span className={`${STATUS_BADGE[inv.status] ?? "badge"} text-xs`}>{inv.status}</span></td>
                        <td className="px-4 py-3">
                          {inv.status === "DRAFT" && (
                            <button onClick={() => handlePost(inv.id, inv.invoice_number)}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-leaf-600 text-white rounded hover:bg-leaf-700 transition-colors">
                              <CheckCircle className="w-3 h-3" />Post
                            </button>
                          )}
                          {inv.status === "POSTED" && (
                            <span className="text-xs text-ink-faint">Posted {inv.posted_at ? formatDate(inv.posted_at) : ""}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Payables Tab */
        <div className="card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-subtle text-ink-muted font-medium border-b border-surface-border">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3 text-right">Invoices</th>
                <th className="px-4 py-3 text-right">Total Invoiced</th>
                <th className="px-4 py-3 text-right">Total Paid</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3">Earliest Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {supplierPayables.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-muted text-sm">No outstanding payables.</td></tr>
              ) : supplierPayables.map((p) => (
                <tr key={p.supplier_id} className="hover:bg-surface-subtle/50">
                  <td className="px-4 py-3 font-medium text-ink">{p.supplier_name}</td>
                  <td className="px-4 py-3 text-right text-ink-muted">{p.invoice_count}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(p.total_invoiced)}</td>
                  <td className="px-4 py-3 text-right text-leaf-600">{formatCurrency(p.total_paid)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-danger-600">{formatCurrency(p.total_outstanding)}</td>
                  <td className={`px-4 py-3 text-xs ${p.earliest_overdue_date ? "text-danger-600 font-medium" : "text-ink-muted"}`}>
                    {p.earliest_overdue_date ? formatDate(p.earliest_overdue_date) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            {supplierPayables.length > 0 && (
              <tfoot className="border-t-2 border-surface-border bg-surface-subtle">
                <tr>
                  <td className="px-4 py-3 font-semibold text-ink">Total</td>
                  <td className="px-4 py-3 text-right text-ink-muted">{supplierPayables.reduce((s,p) => s+p.invoice_count, 0)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(supplierPayables.reduce((s,p) => s+p.total_invoiced, 0))}</td>
                  <td className="px-4 py-3 text-right font-semibold text-leaf-600">{formatCurrency(supplierPayables.reduce((s,p) => s+p.total_paid, 0))}</td>
                  <td className="px-4 py-3 text-right font-semibold text-danger-600">{formatCurrency(totalOutstanding)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Create Invoice Slide-over */}
      {isOpen && <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setIsOpen(false)} />}
      <div className={`fixed inset-y-0 right-0 w-[720px] bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-surface-subtle shrink-0">
          <h2 className="text-base font-semibold text-ink">New Purchase Invoice</h2>
          <button onClick={() => setIsOpen(false)}><X className="w-5 h-5 text-ink-muted" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <form action={handleCreate} className="px-6 py-4 space-y-5">
            {/* GST Type toggle */}
            <div className="flex items-center gap-4 p-3 bg-surface-subtle rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isInterstate} onChange={(e) => setIsInter(e.target.checked)} className="rounded" />
                <span className="text-sm font-medium text-ink">Interstate Purchase</span>
              </label>
              <span className="text-xs text-ink-muted">
                {isInterstate ? "IGST will apply" : "CGST + SGST will apply"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Supplier ID * <span className="text-ink-faint text-xs">(UUID)</span></label>
                <input name="supplier_id" required placeholder="Supplier UUID"
                  className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
              <div>
                <label className="form-label">Supplier Type</label>
                <select name="supplier_type"
                  className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20 bg-white">
                  {["REGISTERED","COMPOSITION","UNREGISTERED","IMPORT","SEZ"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="form-label">Invoice Date *</label>
                <input type="date" name="invoice_date" defaultValue={today} required
                  className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
              <div>
                <label className="form-label">Supplier Invoice No.</label>
                <input name="supplier_invoice_no" placeholder="Supplier's inv no."
                  className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
              <div>
                <label className="form-label">Supplier Invoice Date</label>
                <input type="date" name="supplier_invoice_date"
                  className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Receive Location * <span className="text-ink-faint text-xs">(UUID)</span></label>
                <input name="received_at_location" required placeholder="Location UUID"
                  className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
              <div>
                <label className="form-label">Place of Supply (State Code)</label>
                <input name="place_of_supply" maxLength={2} placeholder="e.g. 09"
                  className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="form-label">Payment Terms (days)</label>
                <input type="number" name="payment_terms_days" defaultValue="30" min="0"
                  className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
              <div>
                <label className="form-label">Other Charges (freight etc.)</label>
                <input type="number" name="other_charges" defaultValue="0" min="0" step="0.01"
                  className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
              <div>
                <label className="form-label">Round-off</label>
                <input type="number" name="round_off" defaultValue="0" step="0.01"
                  className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_reverse_charge" value="true" className="rounded" />
                <span className="text-sm text-ink">Reverse Charge (RCM)</span>
              </label>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="form-label mb-0">GRN Line Items *</label>
                <button type="button" onClick={addLine} className="inline-flex items-center gap-1 text-xs text-leaf-600 hover:underline font-medium">
                  <Plus className="w-3.5 h-3.5" />Add Line
                </button>
              </div>
              {lines.length === 0 ? (
                <div className="border border-dashed border-surface-border rounded-lg p-4 text-center">
                  <p className="text-sm text-ink-muted">Add received goods.</p>
                  <button type="button" onClick={addLine} className="mt-1 text-xs text-leaf-600 hover:underline">+ Add first product</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {lines.map((line, i) => {
                    const gross = line.received_qty * line.unit_price;
                    const disc = gross * line.discount_percent / 100;
                    const taxable = gross - disc;
                    const gstAmt = taxable * line.gst_rate / 100;
                    return (
                      <div key={line.id} className="border border-surface-border rounded-lg p-3 space-y-2 bg-surface-subtle/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-ink-muted">Line {i + 1}</span>
                          <button type="button" onClick={() => removeLine(line.id)}><Trash2 className="w-3.5 h-3.5 text-danger-400 hover:text-danger-600" /></button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="col-span-2">
                            <label className="text-xs text-ink-muted">Product ID *</label>
                            <input value={line.product_id} onChange={(e) => updateLine(line.id, "product_id", e.target.value)}
                              placeholder="UUID" className="w-full border border-surface-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-navy-500/20" />
                          </div>
                          <div>
                            <label className="text-xs text-ink-muted">HSN Code *</label>
                            <input value={line.hsn_code} onChange={(e) => updateLine(line.id, "hsn_code", e.target.value)}
                              placeholder="31021010" className="w-full border border-surface-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-navy-500/20" />
                          </div>
                          <div>
                            <label className="text-xs text-ink-muted">GST %</label>
                            <select value={line.gst_rate} onChange={(e) => updateLine(line.id, "gst_rate", parseFloat(e.target.value))}
                              className="w-full border border-surface-border rounded px-2 py-1.5 text-xs focus:outline-none bg-white">
                              {[0,5,12,18,28].map((r) => <option key={r} value={r}>{r}%</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-xs text-ink-muted">Received Qty *</label>
                            <input type="number" value={line.received_qty} min={0.001} step={0.001}
                              onChange={(e) => updateLine(line.id, "received_qty", parseFloat(e.target.value))}
                              className="w-full border border-surface-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-navy-500/20" />
                          </div>
                          <div>
                            <label className="text-xs text-ink-muted">Free Qty</label>
                            <input type="number" value={line.free_qty} min={0} step={0.001}
                              onChange={(e) => updateLine(line.id, "free_qty", parseFloat(e.target.value))}
                              className="w-full border border-surface-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-navy-500/20" />
                          </div>
                          <div>
                            <label className="text-xs text-ink-muted">UoM *</label>
                            <input value={line.unit_of_measure} onChange={(e) => updateLine(line.id, "unit_of_measure", e.target.value)}
                              placeholder="BAG / KG" className="w-full border border-surface-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-navy-500/20" />
                          </div>
                          <div>
                            <label className="text-xs text-ink-muted">Unit Price *</label>
                            <input type="number" value={line.unit_price} min={0} step={0.01}
                              onChange={(e) => updateLine(line.id, "unit_price", parseFloat(e.target.value))}
                              className="w-full border border-surface-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-navy-500/20" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-ink-muted">Batch No.</label>
                            <input value={line.batch_number} onChange={(e) => updateLine(line.id, "batch_number", e.target.value)}
                              placeholder="Supplier batch" className="w-full border border-surface-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-navy-500/20" />
                          </div>
                          <div>
                            <label className="text-xs text-ink-muted">Mfg Date</label>
                            <input type="date" value={line.manufacture_date} onChange={(e) => updateLine(line.id, "manufacture_date", e.target.value)}
                              className="w-full border border-surface-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-navy-500/20" />
                          </div>
                          <div>
                            <label className="text-xs text-ink-muted">Expiry Date</label>
                            <input type="date" value={line.expiry_date} onChange={(e) => updateLine(line.id, "expiry_date", e.target.value)}
                              className="w-full border border-surface-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-navy-500/20" />
                          </div>
                        </div>
                        <div className="text-right text-xs text-ink-muted">
                          Taxable: <strong className="text-ink">{formatCurrency(taxable)}</strong>
                          {" "}|{" "}
                          {isInterstate ? `IGST: ${formatCurrency(gstAmt)}` : `CGST: ${formatCurrency(gstAmt/2)} + SGST: ${formatCurrency(gstAmt/2)}`}
                          {" "}|{" "}Line Total: <strong className="text-leaf-700">{formatCurrency(taxable + gstAmt)}</strong>
                        </div>
                      </div>
                    );
                  })}

                  {/* Grand totals */}
                  <div className="border-t border-surface-border pt-3 space-y-1 text-sm text-right">
                    <div className="flex justify-between text-ink-muted"><span>Taxable Amount</span><span>{formatCurrency(totals.taxable)}</span></div>
                    {isInterstate
                      ? <div className="flex justify-between text-ink-muted"><span>IGST</span><span>{formatCurrency(totals.igst)}</span></div>
                      : <>
                          <div className="flex justify-between text-ink-muted"><span>CGST</span><span>{formatCurrency(totals.cgst)}</span></div>
                          <div className="flex justify-between text-ink-muted"><span>SGST</span><span>{formatCurrency(totals.sgst)}</span></div>
                        </>
                    }
                    <div className="flex justify-between font-semibold text-ink text-base border-t border-surface-border pt-1">
                      <span>Net Payable</span>
                      <span>{formatCurrency(totals.taxable + totals.cgst + totals.sgst + totals.igst)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="form-label">Narration</label>
              <textarea name="narration" rows={2} placeholder="Notes for this invoice…"
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20 resize-none" />
            </div>

            <div className="flex gap-3 pt-4 border-t border-surface-border sticky bottom-0 bg-white pb-2">
              <button type="submit" disabled={isPending}
                className="flex-1 bg-navy-950 text-white py-2 rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-60 inline-flex items-center justify-center gap-2">
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save as Draft
              </button>
              <button type="button" onClick={() => { setIsOpen(false); setLines([]); }}
                className="px-4 py-2 rounded-lg border border-surface-border text-sm text-ink-muted hover:bg-surface-subtle">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
