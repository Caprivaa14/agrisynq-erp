'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { Calculator, TrendingUp } from 'lucide-react';

type TBRow = {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY';
  account_group: string;
  opening_balance: number;
  opening_balance_type: 'DR' | 'CR';
  period_debit: number;
  period_credit: number;
};

const ACCOUNT_TYPES = ['ALL', 'ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'] as const;

const TYPE_COLORS: Record<TBRow['account_type'], string> = {
  ASSET:     'text-leaf-700',
  LIABILITY: 'text-red-600',
  INCOME:    'text-blue-600',
  EXPENSE:   'text-amber-700',
  EQUITY:    'text-purple-600',
};

function computeClosing(row: TBRow): { dr: number; cr: number } {
  // Opening balance in DR/CR terms
  const openDr = row.opening_balance_type === 'DR' ? row.opening_balance : 0;
  const openCr = row.opening_balance_type === 'CR' ? row.opening_balance : 0;
  const totalDr = openDr + row.period_debit;
  const totalCr = openCr + row.period_credit;
  if (totalDr >= totalCr) return { dr: totalDr - totalCr, cr: 0 };
  return { dr: 0, cr: totalCr - totalDr };
}

export default function TrialBalanceClient({ initialData }: { initialData: TBRow[] }) {
  const [typeFilter, setTypeFilter] = useState<typeof ACCOUNT_TYPES[number]>('ALL');
  const [search, setSearch] = useState('');
  const [showZero, setShowZero] = useState(false);

  const rows = initialData.filter((r) => {
    const closing = computeClosing(r);
    const hasBalance = closing.dr > 0 || closing.cr > 0 || r.period_debit > 0 || r.period_credit > 0;
    if (!showZero && !hasBalance) return false;
    const matchType = typeFilter === 'ALL' || r.account_type === typeFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || r.account_code.toLowerCase().includes(q) || r.account_name.toLowerCase().includes(q) || r.account_group.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  // Grand totals
  const grandDr = rows.reduce((s, r) => {
    const c = computeClosing(r); return s + c.dr;
  }, 0);
  const grandCr = rows.reduce((s, r) => {
    const c = computeClosing(r); return s + c.cr;
  }, 0);
  const isBalanced = Math.abs(grandDr - grandCr) < 0.01;

  // Group by account_group for display
  const groups = Array.from(new Set(rows.map((r) => r.account_group || 'Ungrouped'))).sort();

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trial Balance</h1>
          <p className="page-subtitle">Real-time balance of all ledger accounts from posted journal vouchers.</p>
        </div>
        <div className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold', isBalanced ? 'bg-leaf-50 text-leaf-700' : 'bg-red-50 text-red-700')}>
          <TrendingUp className="w-4 h-4" />
          {isBalanced ? 'Balanced ✓' : `Out of Balance by ${formatCurrency(Math.abs(grandDr - grandCr))}`}
        </div>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {ACCOUNT_TYPES.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors', typeFilter === t ? 'bg-leaf-600 text-white border-leaf-600' : 'bg-surface-subtle text-ink-muted border-surface-border hover:border-leaf-600')}>
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer ml-2">
            <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} className="w-3.5 h-3.5 rounded" />
            Show zero-balance
          </label>
        </div>
        <input type="search" placeholder="Search code, name, group…" value={search} onChange={(e) => setSearch(e.target.value)} className="form-input w-full sm:w-64 text-sm" />
      </div>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Calculator className="w-12 h-12 text-ink-faint mb-4" />
            <p className="text-ink-muted font-medium">No data yet</p>
            <p className="text-ink-faint text-sm mt-1">Post journal vouchers to see the trial balance populate.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Name</th>
                <th>Type</th>
                <th>Group</th>
                <th className="text-right">Opening DR</th>
                <th className="text-right">Opening CR</th>
                <th className="text-right">Period Debit</th>
                <th className="text-right">Period Credit</th>
                <th className="text-right bg-navy-50">Closing DR</th>
                <th className="text-right bg-navy-50">Closing CR</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const groupRows = rows.filter((r) => (r.account_group || 'Ungrouped') === group);
                if (groupRows.length === 0) return null;
                const groupDr = groupRows.reduce((s, r) => s + computeClosing(r).dr, 0);
                const groupCr = groupRows.reduce((s, r) => s + computeClosing(r).cr, 0);
                return (
                  <>
                    <tr key={`g-${group}`} className="bg-surface-subtle">
                      <td colSpan={10} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                        {group}
                      </td>
                    </tr>
                    {groupRows.map((r) => {
                      const closing = computeClosing(r);
                      const openDr = r.opening_balance_type === 'DR' ? r.opening_balance : 0;
                      const openCr = r.opening_balance_type === 'CR' ? r.opening_balance : 0;
                      return (
                        <tr key={r.account_id}>
                          <td><span className="font-mono text-sm font-semibold">{r.account_code}</span></td>
                          <td className={cn('font-medium', TYPE_COLORS[r.account_type])}>{r.account_name}</td>
                          <td><span className="text-2xs text-ink-faint uppercase">{r.account_type}</span></td>
                          <td className="text-xs text-ink-faint">{r.account_group}</td>
                          <td className="text-right font-mono text-sm">{openDr > 0 ? formatCurrency(openDr) : '—'}</td>
                          <td className="text-right font-mono text-sm">{openCr > 0 ? formatCurrency(openCr) : '—'}</td>
                          <td className="text-right font-mono text-sm">{r.period_debit > 0 ? formatCurrency(r.period_debit) : '—'}</td>
                          <td className="text-right font-mono text-sm">{r.period_credit > 0 ? formatCurrency(r.period_credit) : '—'}</td>
                          <td className="text-right font-mono text-sm bg-navy-50/40 font-semibold text-navy-800">{closing.dr > 0 ? formatCurrency(closing.dr) : '—'}</td>
                          <td className="text-right font-mono text-sm bg-navy-50/40 font-semibold text-red-700">{closing.cr > 0 ? formatCurrency(closing.cr) : '—'}</td>
                        </tr>
                      );
                    })}
                    <tr key={`gt-${group}`} className="border-t border-navy-100 bg-navy-50/30 text-sm font-semibold">
                      <td colSpan={8} className="px-4 py-1.5 text-right text-ink-muted text-xs">Group Total</td>
                      <td className="px-4 py-1.5 text-right font-mono text-navy-800">{groupDr > 0 ? formatCurrency(groupDr) : '—'}</td>
                      <td className="px-4 py-1.5 text-right font-mono text-red-700">{groupCr > 0 ? formatCurrency(groupCr) : '—'}</td>
                    </tr>
                  </>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-navy-300">
              <tr className="bg-navy-950 text-white font-bold">
                <td colSpan={8} className="px-4 py-3 text-sm">GRAND TOTAL</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(grandDr)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(grandCr)}</td>
              </tr>
              {!isBalanced && (
                <tr className="bg-red-50">
                  <td colSpan={10} className="px-4 py-2 text-sm text-red-700 font-medium flex items-center gap-2">
                    ⚠ Trial balance is out of balance by {formatCurrency(Math.abs(grandDr - grandCr))}. Check for unposted or partially entered vouchers.
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
