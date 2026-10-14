"use client";

import { useState, useTransition } from "react";
import { Plus, X, FileText, AlertTriangle, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatCurrency } from "@/lib/utils";
import { createCreditNote, postCreditNote } from "@/actions/credit-notes";

// ─── Types ────────────────────────────────────────────────────────────────────

type CreditNoteStatus = "DRAFT" | "POSTED";

type CreditNoteReason =
  | "RETURN_OF_GOODS"
  | "PRICE_ADJUSTMENT"
  | "GOODS_DEFECTIVE"
  | "EXCESS_BILLED"
  | "DISCOUNT_POST_SALE"
  | "OTHER";

interface CreditNote {
  id: string;
  credit_note_number: string;
  credit_note_date: string;
  reason: CreditNoteReason;
  status: CreditNoteStatus;
  customer_id: string;
  customer_name: string;
  customer_gstin: string | null;
  parties: { name: string } | null;
  original_invoice_id: string;
  sales_invoices: { invoice_number: string } | null;
  goods_returned: boolean;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  created_at: string;
  posted_at: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REASON_LABELS: Record<CreditNoteReason, string> = {
  RETURN_OF_GOODS: "Return of Goods",
  PRICE_ADJUSTMENT: "Price Adjustment",
  GOODS_DEFECTIVE: "Goods Defective",
  EXCESS_BILLED: "Excess Billed",
  DISCOUNT_POST_SALE: "Discount Post Sale",
  OTHER: "Other",
};

const REASON_BADGE_CLASS: Record<CreditNoteReason, string> = {
  RETURN_OF_GOODS: "badge-info",
  PRICE_ADJUSTMENT: "badge-warning",
  GOODS_DEFECTIVE: "badge-danger",
  EXCESS_BILLED: "badge-warning",
  DISCOUNT_POST_SALE: "badge",
  OTHER: "badge",
};

const STATUS_FILTERS = ["ALL", "DRAFT", "POSTED"] as const;
type FilterStatus = (typeof STATUS_FILTERS)[number];

// ─── Line Item ─────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  product_id: string;
  original_line_id: string;
  hsn_code: string;
  batch_id: string;
  return_qty: string;
  unit_of_measure: string;
  unit_price: string;
  gst_rate: string;
}

const emptyLine = (): LineItem => ({
  id: crypto.randomUUID(),
  product_id: "",
  original_line_id: "",
  hsn_code: "",
  batch_id: "",
  return_qty: "",
  unit_of_measure: "BAG",
  unit_price: "",
  gst_rate: "18",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcLineTotals(lines: LineItem[]) {
  let taxable = 0;
  let gstTotal = 0;
  for (const l of lines) {
    const qty = parseFloat(l.return_qty) || 0;
    const price = parseFloat(l.unit_price) || 0;
    const rate = parseFloat(l.gst_rate) || 0;
    const lineBase = qty * price;
    const lineGst = (lineBase * rate) / 100;
    taxable += lineBase;
    gstTotal += lineGst;
  }
  return { taxable, gstTotal, total: taxable + gstTotal };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreditNotesClient({
  initialNotes,
}: {
  initialNotes: CreditNote[];
}) {
  const [notes, setNotes] = useState<CreditNote[]>(initialNotes);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [slideOver, setSlideOver] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [postingId, setPostingId] = useState<string | null>(null);

  // Form state
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [goodsReturned, setGoodsReturned] = useState(false);

  // ── Filter ──────────────────────────────────────────────────────────────────

  const visible =
    filter === "ALL" ? notes : notes.filter((n) => n.status === filter);

  // ── Post action ─────────────────────────────────────────────────────────────

  function handlePost(note: CreditNote) {
    if (
      !window.confirm(
        `Post credit note ${note.credit_note_number}? This will reverse stock and adjust ledgers.`
      )
    )
      return;

    setPostingId(note.id);
    startTransition(async () => {
      try {
        await postCreditNote(note.id);
        setNotes((prev) =>
          prev.map((n) =>
            n.id === note.id
              ? { ...n, status: "POSTED", posted_at: new Date().toISOString() }
              : n
          )
        );
        toast.success("Credit note posted. Stock reversed.");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to post credit note.");
      } finally {
        setPostingId(null);
      }
    });
  }

  // ── Create action ───────────────────────────────────────────────────────────

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    // Append lines as JSON
    fd.append("lines", JSON.stringify(lines));

    startTransition(async () => {
      const result = await createCreditNote(undefined as never, fd);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`Credit note ${result.cnNumber ?? ""} created.`);
        setSlideOver(false);
        form.reset();
        setLines([emptyLine()]);
        setGoodsReturned(false);
      }
    });
  }

  // ── Line helpers ────────────────────────────────────────────────────────────

  function updateLine(id: string, field: keyof LineItem, value: string) {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  const totals = calcLineTotals(lines);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Credit Notes</h1>
          <p className="page-subtitle">
            Manage GST credit notes against posted sales invoices
          </p>
        </div>
        <button
          onClick={() => setSlideOver(true)}
          className="flex items-center gap-2 bg-navy-950 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          New Credit Note
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === s
                ? "bg-navy-950 text-white border-navy-950"
                : "border-surface-border text-ink-muted bg-white hover:bg-surface-subtle"
            }`}
          >
            {s}
            <span className="ml-1.5 opacity-70">
              {s === "ALL"
                ? notes.length
                : notes.filter((n) => n.status === s).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center gap-3">
          <FileText className="h-10 w-10 text-ink-faint" />
          <p className="text-ink-muted text-sm">No credit notes found.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle border-b border-surface-border">
              <tr>
                {[
                  "CN Number",
                  "Date",
                  "Customer",
                  "Original Invoice",
                  "Reason",
                  "Taxable",
                  "GST",
                  "Total",
                  "Goods Returned",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-ink-muted whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {visible.map((note) => {
                const gst =
                  note.cgst_amount + note.sgst_amount + note.igst_amount;
                return (
                  <tr
                    key={note.id}
                    className="hover:bg-surface-subtle transition-colors"
                  >
                    {/* CN Number */}
                    <td className="px-4 py-3 font-mono text-xs text-leaf-700 font-semibold whitespace-nowrap">
                      {note.credit_note_number}
                    </td>
                    {/* Date */}
                    <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
                      {formatDate(note.credit_note_date)}
                    </td>
                    {/* Customer */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy-950">
                        {note.parties?.name ?? note.customer_name}
                      </p>
                      {note.customer_gstin && (
                        <p className="text-xs text-ink-faint font-mono">
                          {note.customer_gstin}
                        </p>
                      )}
                    </td>
                    {/* Original Invoice */}
                    <td className="px-4 py-3">
                      {note.sales_invoices ? (
                        <span className="text-leaf-600 font-mono text-xs font-semibold hover:underline cursor-pointer">
                          {note.sales_invoices.invoice_number}
                        </span>
                      ) : (
                        <span className="text-ink-faint text-xs">—</span>
                      )}
                    </td>
                    {/* Reason */}
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${REASON_BADGE_CLASS[note.reason]}`}
                      >
                        {REASON_LABELS[note.reason]}
                      </span>
                    </td>
                    {/* Taxable */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {formatCurrency(note.taxable_amount)}
                    </td>
                    {/* GST */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {formatCurrency(gst)}
                    </td>
                    {/* Total */}
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                      {formatCurrency(note.total_amount)}
                    </td>
                    {/* Goods Returned */}
                    <td className="px-4 py-3 text-center">
                      {note.goods_returned ? (
                        <span className="badge-success badge">Yes</span>
                      ) : (
                        <span className="text-ink-faint text-xs">No</span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${
                          note.status === "POSTED"
                            ? "badge-success"
                            : "badge-warning"
                        }`}
                      >
                        {note.status}
                      </span>
                    </td>
                    {/* Action */}
                    <td className="px-4 py-3">
                      {note.status === "DRAFT" && (
                        <button
                          onClick={() => handlePost(note)}
                          disabled={postingId === note.id || isPending}
                          className="text-xs bg-navy-950 text-white px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {postingId === note.id ? "Posting…" : "Post"}
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

      {/* ── Slide-over ────────────────────────────────────────────────────────── */}
      {/* Backdrop */}
      {slideOver && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setSlideOver(false)}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full z-50 shadow-xl bg-white flex flex-col transition-transform duration-300 ${
          slideOver ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: 680 }}
      >
        {/* Slide-over header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-surface-subtle">
          <div>
            <h2 className="text-base font-semibold text-navy-950">
              New Credit Note
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Issue a GST credit note against a posted invoice
            </p>
          </div>
          <button
            onClick={() => setSlideOver(false)}
            className="p-2 rounded-md hover:bg-surface-border transition-colors"
          >
            <X className="h-5 w-5 text-ink-muted" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleCreate} className="p-6 space-y-6">
            {/* ── Warning banner ─────────────────────────────────────────────── */}
            <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Important — Before You Proceed
                </p>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  Credit notes must reference a posted invoice. The credit note
                  amount{" "}
                  <strong>cannot exceed</strong> the original invoice value.
                  Posting will reverse relevant stock entries.
                </p>
              </div>
            </div>

            {/* ── Invoice & header fields ─────────────────────────────────────── */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                Reference &amp; Header
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Original Invoice ID */}
                <div className="col-span-2">
                  <label className="form-label">
                    Original Invoice ID{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="original_invoice_id"
                    required
                    type="text"
                    placeholder="Paste posted invoice UUID"
                    className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy-950/30"
                  />
                  <p className="text-xs text-ink-faint mt-1">
                    Only posted invoices are valid references.
                  </p>
                </div>

                {/* Credit Note Date */}
                <div>
                  <label className="form-label">
                    Credit Note Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="credit_note_date"
                    required
                    type="date"
                    className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-950/30"
                  />
                </div>

                {/* Reason */}
                <div>
                  <label className="form-label">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="reason"
                    required
                    className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-950/30"
                  >
                    <option value="">Select reason…</option>
                    {(
                      Object.entries(REASON_LABELS) as [
                        CreditNoteReason,
                        string
                      ][]
                    ).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reason Detail */}
                <div className="col-span-2">
                  <label className="form-label">Reason Detail</label>
                  <textarea
                    name="reason_detail"
                    rows={2}
                    placeholder="Additional notes about this credit note…"
                    className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-950/30 resize-none"
                  />
                </div>

                {/* Goods Returned checkbox */}
                <div className="col-span-2 flex items-center gap-3">
                  <input
                    id="goods_returned"
                    name="goods_returned"
                    type="checkbox"
                    checked={goodsReturned}
                    onChange={(e) => setGoodsReturned(e.target.checked)}
                    className="h-4 w-4 rounded border-surface-border text-navy-950"
                  />
                  <label
                    htmlFor="goods_returned"
                    className="text-sm font-medium text-navy-950 cursor-pointer"
                  >
                    Goods are physically being returned
                  </label>
                </div>

                {/* Return to location — conditional */}
                {goodsReturned && (
                  <div className="col-span-2">
                    <label className="form-label">
                      Return to Location ID{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="return_to_location"
                      required
                      type="text"
                      placeholder="Warehouse / location UUID"
                      className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy-950/30"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* ── Line Items ──────────────────────────────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                  Line Items
                </h3>
                <button
                  type="button"
                  onClick={() => setLines((prev) => [...prev, emptyLine()])}
                  className="flex items-center gap-1 text-xs text-leaf-600 font-semibold hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Line
                </button>
              </div>

              <div className="space-y-3">
                {lines.map((line, idx) => (
                  <div
                    key={line.id}
                    className="rounded-lg border border-surface-border bg-surface-subtle p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-ink-muted">
                        Line {idx + 1}
                      </span>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Product ID */}
                      <div>
                        <label className="form-label">
                          Product ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={line.product_id}
                          onChange={(e) =>
                            updateLine(line.id, "product_id", e.target.value)
                          }
                          placeholder="Product UUID"
                          className="w-full border border-surface-border rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-navy-950/30"
                        />
                      </div>
                      {/* Original Line ID */}
                      <div>
                        <label className="form-label">
                          Original Line ID{" "}
                          <span className="text-ink-faint">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={line.original_line_id}
                          onChange={(e) =>
                            updateLine(
                              line.id,
                              "original_line_id",
                              e.target.value
                            )
                          }
                          placeholder="Invoice line UUID"
                          className="w-full border border-surface-border rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-navy-950/30"
                        />
                      </div>
                      {/* HSN Code */}
                      <div>
                        <label className="form-label">
                          HSN Code <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={line.hsn_code}
                          onChange={(e) =>
                            updateLine(line.id, "hsn_code", e.target.value)
                          }
                          placeholder="e.g. 31021000"
                          className="w-full border border-surface-border rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-navy-950/30"
                        />
                      </div>
                      {/* Batch ID */}
                      <div>
                        <label className="form-label">Batch ID</label>
                        <input
                          type="text"
                          value={line.batch_id}
                          onChange={(e) =>
                            updateLine(line.id, "batch_id", e.target.value)
                          }
                          placeholder="Batch UUID"
                          className="w-full border border-surface-border rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-navy-950/30"
                        />
                      </div>
                      {/* Return Qty */}
                      <div>
                        <label className="form-label">
                          Return Qty <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={line.return_qty}
                          onChange={(e) =>
                            updateLine(line.id, "return_qty", e.target.value)
                          }
                          placeholder="0.000"
                          className="w-full border border-surface-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-navy-950/30"
                        />
                      </div>
                      {/* UoM */}
                      <div>
                        <label className="form-label">Unit of Measure</label>
                        <select
                          value={line.unit_of_measure}
                          onChange={(e) =>
                            updateLine(
                              line.id,
                              "unit_of_measure",
                              e.target.value
                            )
                          }
                          className="w-full border border-surface-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-navy-950/30"
                        >
                          {["BAG", "KG", "MT", "LITRE", "NOS"].map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* Unit Price */}
                      <div>
                        <label className="form-label">
                          Unit Price (₹){" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price}
                          onChange={(e) =>
                            updateLine(line.id, "unit_price", e.target.value)
                          }
                          placeholder="0.00"
                          className="w-full border border-surface-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-navy-950/30"
                        />
                      </div>
                      {/* GST Rate */}
                      <div>
                        <label className="form-label">GST Rate (%)</label>
                        <select
                          value={line.gst_rate}
                          onChange={(e) =>
                            updateLine(line.id, "gst_rate", e.target.value)
                          }
                          className="w-full border border-surface-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-navy-950/30"
                        >
                          {["0", "5", "12", "18", "28"].map((r) => (
                            <option key={r} value={r}>
                              {r}%
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Live Totals ─────────────────────────────────────────────────── */}
            <section className="rounded-lg border border-surface-border bg-surface-subtle p-4 space-y-2">
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
                Live Totals
              </h3>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Taxable Amount</span>
                <span className="font-medium">
                  {formatCurrency(totals.taxable)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">GST Amount</span>
                <span className="font-medium">
                  {formatCurrency(totals.gstTotal)}
                </span>
              </div>
              <div className="border-t border-surface-border pt-2 flex justify-between">
                <span className="font-semibold text-navy-950">
                  Total Credit Amount
                </span>
                <span className="font-bold text-leaf-700 text-base">
                  {formatCurrency(totals.total)}
                </span>
              </div>
            </section>

            {/* ── Submit ──────────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 bg-navy-950 text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {isPending ? (
                  "Creating…"
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4" />
                    Create Credit Note
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSlideOver(false)}
                className="px-5 py-2.5 border border-surface-border text-ink-muted rounded-lg text-sm hover:bg-surface-subtle transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
