'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PiggyBank, AlertCircle } from 'lucide-react';

type AgeRow = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  grand_total: number;
  amount_paid: number;
  outstanding: number;
  daysOverdue: number;
  party: { id: string; name: string; gstin: string | null } | null;
};

function agingBucket(days: number): { label: string; cls: string } {
  if (days <= 0)  return { label: 'Current',   cls: 'badge badge-success' };
  if (days <= 30) return { label: '1–30 days',  cls: 'badge badge-warning' };
  if (days <= 60) return { label: '31–60 days', cls: 'badge badge-warning' };
  if (days <= 90) return { label: '61–90 days', cls: 'badge badge-danger' };
  return               { label: '90+ days',    cls: 'badge badge-danger' };
}

const BUCKETS = ['ALL', 'Current', '1–30 days', '31–60 days', '61–90 days', '90+ days'] as const;

export default function APClient({ initialData }: { initialData: AgeRow[] }) {
  const [bucket, setBucket] = useState<typeof BUCKETS[number]>('ALL');
  const [search, setSearch] = useState('');

  const rows = initialData.filter((r) => {
    const b = agingBucket(r.daysOverdue);
    const matchBucket = bucket === 'ALL' || b.label === bucket;
    const q = search.toLowerCase();
    const matchSearch = !q || r.invoice_no.toLowerCase().includes(q) || r.party?.name.toLowerCase().includes(q);
    return matchBucket && matchSearch;
  });

  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);

  const bucketTotals = (['Current', '1–30 days', '31–60 days', '61–90 days', '90+ days'] as const).map((b) => ({
    label: b,
    total: initialData.filter((r) => agingBucket(r.daysOverdue).label === b).reduce((s, r) => s + r.outstanding, 0),
    count: initialData.filter((r) => agingBucket(r.daysOverdue).label === b).length,
  }));

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">AP — Payables</h1>
          <p className="page-subtitle">Outstanding purchase invoices with ageing. Total due: <strong>{formatCurrency(initialData.reduce((s, r) => s + r.outstanding, 0))}</strong></p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {bucketTotals.map((b) => (
          <button key={b.label} onClick={() => setBucket(bucket === b.label ? 'ALL' : b.label)} className={cn('card p-4 text-left transition-all hover:shadow-md', bucket === b.label && 'ring-2 ring-leaf-600')}>
            <div className="text-lg font-bold text-navy-950">{formatCurrency(b.total)}</div>
            <div className="text-xs text-ink-muted mt-1">{b.label}</div>
            <div className="text-2xs text-ink-faint">{b.count} invoice{b.count !== 1 ? 's' : ''}</div>
          </button>
        ))}
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {BUCKETS.map((b) => (
            <button key={b} onClick={() => setBucket(b)} className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors', bucket === b ? 'bg-leaf-600 text-white border-leaf-600' : 'bg-surface-subtle text-ink-muted border-surface-border hover:border-leaf-600')}>
              {b}
            </button>
          ))}
        </div>
        <input type="search" placeholder="Search invoice no, supplier…" value={search} onChange={(e) => setSearch(e.target.value)} className="form-input w-full sm:w-64 text-sm" />
      </div>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <PiggyBank className="w-12 h-12 text-ink-faint mb-4" />
            <p className="text-ink-muted font-medium">No outstanding payables</p>
            <p className="text-ink-faint text-sm mt-1">All purchase invoices have been paid. 🎉</p>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice No</th><th>Invoice Date</th><th>Due Date</th><th>Supplier</th>
                  <th className="text-right">Invoice Total</th><th className="text-right">Paid</th>
                  <th className="text-right">Outstanding</th><th>Ageing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const b = agingBucket(r.daysOverdue);
                  return (
                    <tr key={r.id} className={cn(r.daysOverdue > 90 && 'bg-red-50/50')}>
                      <td><span className="font-mono text-sm text-leaf-700">{r.invoice_no}</span></td>
                      <td className="text-sm">{formatDate(r.invoice_date)}</td>
                      <td className="text-sm">{r.due_date ? formatDate(r.due_date) : '—'}</td>
                      <td>
                        <div className="text-sm font-medium">{r.party?.name ?? '—'}</div>
                        {r.party?.gstin && <div className="font-mono text-xs text-ink-faint">{r.party.gstin}</div>}
                      </td>
                      <td className="text-right font-mono text-sm">{formatCurrency(r.grand_total)}</td>
                      <td className="text-right font-mono text-sm text-leaf-700">{formatCurrency(r.amount_paid)}</td>
                      <td className="text-right font-mono font-bold text-red-600">{formatCurrency(r.outstanding)}</td>
                      <td>
                        <div className="flex flex-col gap-0.5">
                          <span className={b.cls}>{b.label}</span>
                          {r.daysOverdue > 0 && <span className="text-2xs text-ink-faint">{r.daysOverdue}d overdue</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-navy-200">
                <tr className="bg-surface-subtle font-semibold">
                  <td colSpan={4} className="px-4 py-2 text-sm text-ink-muted">Total ({rows.length} invoices)</td>
                  <td className="px-4 py-2 text-right font-mono">{formatCurrency(rows.reduce((s, r) => s + r.grand_total, 0))}</td>
                  <td className="px-4 py-2 text-right font-mono text-leaf-700">{formatCurrency(rows.reduce((s, r) => s + r.amount_paid, 0))}</td>
                  <td className="px-4 py-2 text-right font-mono text-red-600">{formatCurrency(totalOutstanding)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            {rows.some((r) => r.daysOverdue > 90) && (
              <div className="px-4 py-3 bg-red-50 border-t border-red-100 flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Some payables are overdue by more than 90 days. Prioritise settlement to avoid supplier disputes.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
