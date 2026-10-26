'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDate, formatCurrency } from '@/lib/utils';
import { ScrollText, Plus, X, AlertCircle, ChevronDown, CheckCircle } from 'lucide-react';
import { createJournalVoucher, postJournalVoucher } from '@/actions/accounting';

type JVLine = {
  id: string;
  line_no: number;
  debit_amount: number;
  credit_amount: number;
  narration: string | null;
  account: { id: string; account_code: string; account_name: string; account_type: string } | null;
};

type JV = {
  id: string;
  voucher_no: string;
  voucher_date: string;
  voucher_type: string;
  narration: string;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  total_debit: number;
  total_credit: number;
  posted_at: string | null;
  created_at: string;
  lines: JVLine[];
};

type FormLine = { account_id: string; debit_amount: number; credit_amount: number; narration: string };

const VOUCHER_TYPES = ['JOURNAL', 'PAYMENT', 'RECEIPT', 'CONTRA', 'PURCHASE', 'SALES', 'CREDIT_NOTE', 'DEBIT_NOTE'];
const STATUS_FILTERS = ['ALL', 'DRAFT', 'POSTED', 'CANCELLED'] as const;

export default function JournalVouchersClient({ initialData }: { initialData: JV[] }) {
  const [vouchers, setVouchers] = useState<JV[]>(initialData);
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('ALL');
  const [search, setSearch] = useState('');
  const [showSlide, setShowSlide] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = vouchers.filter((v) => {
    const matchStatus = statusFilter === 'ALL' || v.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || v.voucher_no.toLowerCase().includes(q) || v.narration.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  function handlePost(id: string, voucherNo: string) {
    if (!confirm(`Post voucher ${voucherNo}? Posted vouchers cannot be edited.`)) return;
    startTransition(async () => {
      const res = await postJournalVoucher(id);
      if (res.success) {
        toast.success(`Voucher ${voucherNo} posted.`);
        setVouchers((p) => p.map((v) => v.id === id ? { ...v, status: 'POSTED', posted_at: new Date().toISOString() } : v));
      } else {
        toast.error(res.error ?? 'Failed to post');
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Journal Vouchers</h1>
          <p className="page-subtitle">Double-entry bookkeeping — every debit must have an equal credit.</p>
        </div>
        <button onClick={() => setShowSlide(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />New Voucher
        </button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors', statusFilter === s ? 'bg-leaf-600 text-white border-leaf-600' : 'bg-surface-subtle text-ink-muted border-surface-border hover:border-leaf-600')}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
              {s !== 'ALL' && <span className="ml-1.5 bg-navy-800 text-navy-300 px-1 rounded-full">{vouchers.filter((v) => v.status === s).length}</span>}
            </button>
          ))}
        </div>
        <input type="search" placeholder="Search voucher no, narration…" value={search} onChange={(e) => setSearch(e.target.value)} className="form-input w-full sm:w-64 text-sm" />
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ScrollText className="w-12 h-12 text-ink-faint mb-4" />
            <p className="text-ink-muted font-medium">No journal vouchers found</p>
            <button onClick={() => setShowSlide(true)} className="btn-primary mt-4 flex items-center gap-2"><Plus className="w-4 h-4" />New Voucher</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Voucher No</th><th>Date</th><th>Type</th><th>Narration</th>
                <th className="text-right">Total Debit</th><th className="text-right">Total Credit</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <>
                  <tr key={v.id} className="cursor-pointer hover:bg-surface-subtle" onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}>
                    <td><span className="font-mono text-sm text-leaf-700">{v.voucher_no}</span></td>
                    <td className="text-sm">{formatDate(v.voucher_date)}</td>
                    <td><span className="badge badge-info text-2xs">{v.voucher_type}</span></td>
                    <td className="text-sm text-ink-muted max-w-[200px] truncate">{v.narration || '—'}</td>
                    <td className="text-right font-mono text-sm">{formatCurrency(v.total_debit)}</td>
                    <td className="text-right font-mono text-sm">{formatCurrency(v.total_credit)}</td>
                    <td>
                      <span className={cn('badge', v.status === 'POSTED' ? 'badge-success' : v.status === 'DRAFT' ? 'badge-warning' : 'badge-danger')}>
                        {v.status.charAt(0) + v.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        {v.status === 'DRAFT' && (
                          <button onClick={() => handlePost(v.id, v.voucher_no)} disabled={isPending} className="btn-sm bg-leaf-600 hover:bg-leaf-700 text-white font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />Post
                          </button>
                        )}
                        <button onClick={() => setExpandedId(expandedId === v.id ? null : v.id)} className="btn-sm btn-ghost flex items-center gap-1">
                          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expandedId === v.id && 'rotate-180')} />Lines
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === v.id && (
                    <tr key={`${v.id}-exp`} className="bg-surface-subtle">
                      <td colSpan={8} className="px-4 py-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-ink-faint text-xs uppercase">
                              <th className="pb-1 pr-4">#</th><th className="pb-1 pr-4">Account</th><th className="pb-1 pr-4">Narration</th>
                              <th className="pb-1 pr-4 text-right">Debit</th><th className="pb-1 text-right">Credit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {v.lines.sort((a, b) => a.line_no - b.line_no).map((l) => (
                              <tr key={l.id} className="border-t border-surface-border">
                                <td className="py-1 pr-4 text-ink-faint">{l.line_no}</td>
                                <td className="py-1 pr-4 font-medium">
                                  <span className="font-mono text-xs text-ink-faint mr-2">{l.account?.account_code}</span>
                                  {l.account?.account_name}
                                </td>
                                <td className="py-1 pr-4 text-ink-muted text-xs">{l.narration || '—'}</td>
                                <td className="py-1 pr-4 text-right font-mono">{l.debit_amount > 0 ? formatCurrency(l.debit_amount) : '—'}</td>
                                <td className="py-1 text-right font-mono">{l.credit_amount > 0 ? formatCurrency(l.credit_amount) : '—'}</td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-navy-200 font-semibold text-sm">
                              <td colSpan={3} className="py-1 text-right pr-4 text-ink-muted">TOTAL</td>
                              <td className="py-1 pr-4 text-right font-mono">{formatCurrency(v.total_debit)}</td>
                              <td className="py-1 text-right font-mono">{formatCurrency(v.total_credit)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showSlide && (
        <NewJVSlideOver
          onClose={() => setShowSlide(false)}
          onCreated={(jv) => { setVouchers((p) => [jv as JV, ...p]); setShowSlide(false); toast.success(`Voucher ${jv.voucher_no} created.`); }}
        />
      )}
    </div>
  );
}

function NewJVSlideOver({ onClose, onCreated }: { onClose: () => void; onCreated: (jv: { voucher_no: string; [k: string]: unknown }) => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [lines, setLines] = useState<FormLine[]>([
    { account_id: '', debit_amount: 0, credit_amount: 0, narration: '' },
    { account_id: '', debit_amount: 0, credit_amount: 0, narration: '' },
  ]);

  const totalDr = lines.reduce((s, l) => s + l.debit_amount, 0);
  const totalCr = lines.reduce((s, l) => s + l.credit_amount, 0);
  const isBalanced = Math.abs(totalDr - totalCr) < 0.001 && totalDr > 0;

  function updateLine(i: number, field: keyof FormLine, value: string | number) {
    setLines((l) => l.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('');
    const fd = new FormData(e.currentTarget);
    const input = {
      voucher_no:   String(fd.get('voucher_no') ?? ''),
      voucher_date: String(fd.get('voucher_date') ?? ''),
      voucher_type: String(fd.get('voucher_type') ?? '') as typeof VOUCHER_TYPES[number],
      narration:    String(fd.get('narration') ?? ''),
      lines: lines.map((l) => ({
        account_id:    l.account_id,
        debit_amount:  Number(l.debit_amount),
        credit_amount: Number(l.credit_amount),
        narration:     l.narration || null,
      })),
    };
    startTransition(async () => {
      const res = await createJournalVoucher(input as Parameters<typeof createJournalVoucher>[0]);
      if (res.success && res.data) onCreated(res.data as { voucher_no: string });
      else setError(res.error ?? 'Failed to create voucher');
    });
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 animate-fade-in" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 right-0 z-50 w-[700px] max-w-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-surface-subtle shrink-0">
          <div>
            <h2 className="text-base font-semibold text-navy-950">New Journal Voucher</h2>
            <p className="text-xs text-ink-muted mt-0.5">Debit total must equal Credit total before posting.</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-border rounded-lg"><X className="w-5 h-5 text-ink-muted" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="form-label">Voucher No *</label>
                <input name="voucher_no" className="form-input" placeholder="JV-2025-001" required />
              </div>
              <div>
                <label className="form-label">Date *</label>
                <input name="voucher_date" type="date" className="form-input" defaultValue={new Date().toISOString().split('T')[0]} required />
              </div>
              <div>
                <label className="form-label">Type *</label>
                <select name="voucher_type" className="form-input" required>
                  {VOUCHER_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase().replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <label className="form-label">Narration</label>
                <input name="narration" className="form-input" placeholder="Purpose of this journal entry" />
              </div>
            </div>

            {/* Lines */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Ledger Lines *</h3>
                <button type="button" onClick={() => setLines((l) => [...l, { account_id: '', debit_amount: 0, credit_amount: 0, narration: '' }])} className="btn-ghost text-xs flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />Add Line
                </button>
              </div>
              <div className="border border-surface-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface-subtle">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-ink-faint font-medium w-8">#</th>
                      <th className="text-left px-3 py-2 text-xs text-ink-faint font-medium">Account ID (UUID)</th>
                      <th className="text-left px-3 py-2 text-xs text-ink-faint font-medium w-32">Debit (₹)</th>
                      <th className="text-left px-3 py-2 text-xs text-ink-faint font-medium w-32">Credit (₹)</th>
                      <th className="text-left px-3 py-2 text-xs text-ink-faint font-medium">Narration</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="border-t border-surface-border">
                        <td className="px-3 py-2 text-ink-faint">{i + 1}</td>
                        <td className="px-3 py-2">
                          <input value={line.account_id} onChange={(e) => updateLine(i, 'account_id', e.target.value)} className="form-input font-mono text-xs w-full" placeholder="UUID" required />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min={0} step={0.01} value={line.debit_amount || ''} onChange={(e) => updateLine(i, 'debit_amount', Number(e.target.value))} className="form-input text-right w-full" placeholder="0.00" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min={0} step={0.01} value={line.credit_amount || ''} onChange={(e) => updateLine(i, 'credit_amount', Number(e.target.value))} className="form-input text-right w-full" placeholder="0.00" />
                        </td>
                        <td className="px-3 py-2">
                          <input value={line.narration} onChange={(e) => updateLine(i, 'narration', e.target.value)} className="form-input text-sm w-full" placeholder="Optional" />
                        </td>
                        <td className="px-2">
                          {lines.length > 2 && (
                            <button type="button" onClick={() => setLines((l) => l.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 p-0.5"><X className="w-3.5 h-3.5" /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-navy-200 bg-surface-subtle font-semibold">
                      <td colSpan={2} className="px-3 py-2 text-xs text-ink-muted text-right">TOTAL</td>
                      <td className="px-3 py-2 text-right font-mono text-sm">{formatCurrency(totalDr)}</td>
                      <td className="px-3 py-2 text-right font-mono text-sm">{formatCurrency(totalCr)}</td>
                      <td colSpan={2} className="px-3 py-2">
                        {isBalanced ? (
                          <span className="text-leaf-600 text-xs font-medium flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Balanced</span>
                        ) : (
                          <span className="text-red-500 text-xs font-medium">
                            Diff: {formatCurrency(Math.abs(totalDr - totalCr))}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-surface-border bg-surface-subtle flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={isPending || !isBalanced} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              <ScrollText className={cn('w-4 h-4', isPending && 'animate-spin')} />
              {isPending ? 'Saving…' : 'Save Voucher'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
