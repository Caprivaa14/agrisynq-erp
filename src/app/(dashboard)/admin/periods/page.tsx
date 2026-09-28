import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/actions/context";
import { formatDate } from "@/lib/utils";
import { Lock, Unlock, CalendarDays } from "lucide-react";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Period Locks" };

const LOCK_TYPE_LABELS: Record<string, string> = {
  FINANCIAL: "Financial Ledger",
  GST: "GST Returns",
  FMS: "FMS Compliance",
  BANK: "Bank Reconciliation",
  STOCK: "Stock Closing",
};

const LOCK_TYPE_COLORS: Record<string, string> = {
  FINANCIAL: "badge-info",
  GST: "badge-warning",
  FMS: "badge",
  BANK: "badge-success",
  STOCK: "badge",
};

export default async function PeriodLocksPage() {
  const supabase = createClient();

  let ctx;
  try {
    ctx = await getUserContext();
  } catch {
    redirect("/login");
  }

  const { data: locks } = await supabase
    .from("period_locks")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("period_from", { ascending: false });

  const activeLocks = locks?.filter((l) => l.is_locked) ?? [];
  const historicalLocks = locks?.filter((l) => !l.is_locked) ?? [];

  return (
    <div className="page-container space-y-6">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold-100 flex items-center justify-center">
            <Lock className="w-5 h-5 text-gold-700" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="page-title">Period Locks</h1>
            <p className="page-subtitle">
              Financial, GST, FMS, bank, and stock period controls
            </p>
          </div>
        </div>
      </div>

      {/* Active Locks */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
          <Lock className="w-4 h-4 text-danger-600" strokeWidth={1.75} />
          Currently Locked Periods ({activeLocks.length})
        </h2>

        {activeLocks.length === 0 ? (
          <div className="card p-6 text-center">
            <Unlock className="w-8 h-8 text-leaf-500 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-ink-muted">No periods are currently locked.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Period
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Branch
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Locked At
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Reason
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {activeLocks.map((lock) => (
                  <tr key={lock.id} className="hover:bg-surface-subtle">
                    <td className="py-3 px-4">
                      <span className={LOCK_TYPE_COLORS[lock.lock_type] ?? "badge"}>
                        {LOCK_TYPE_LABELS[lock.lock_type] ?? lock.lock_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-ink">
                      {formatDate(lock.period_from)} — {formatDate(lock.period_to)}
                    </td>
                    <td className="py-3 px-4 text-xs text-ink-muted">
                      {lock.branch_id ? lock.branch_id.slice(0, 8) + "…" : "All branches"}
                    </td>
                    <td className="py-3 px-4 text-xs text-ink-muted">
                      {lock.locked_at ? formatDate(lock.locked_at) : "—"}
                    </td>
                    <td className="py-3 px-4 text-xs text-ink-muted max-w-[200px] truncate">
                      {lock.lock_reason ?? "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 badge-danger text-xs">
                        <Lock className="w-3 h-3" strokeWidth={2} />
                        Locked
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historical (Unlocked) */}
      {historicalLocks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />
            Previously Unlocked Periods ({historicalLocks.length})
          </h2>
          <div className="card overflow-hidden">
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Period
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Unlocked At
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Unlock Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {historicalLocks.map((lock) => (
                  <tr key={lock.id} className="hover:bg-surface-subtle opacity-70">
                    <td className="py-2.5 px-4">
                      <span className="badge">
                        {LOCK_TYPE_LABELS[lock.lock_type] ?? lock.lock_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-ink-muted">
                      {formatDate(lock.period_from)} — {formatDate(lock.period_to)}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-ink-muted">
                      {lock.unlocked_at ? formatDate(lock.unlocked_at) : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-ink-muted max-w-[200px] truncate">
                      {lock.unlock_reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-ink-faint">
        Period lock management requires the{" "}
        <span className="font-medium">admin_periods:approve</span> permission.
        Unlock operations are recorded in the audit log.
      </p>
    </div>
  );
}
