import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/actions/context";
import { formatDateTime } from "@/lib/utils";
import { Shield, Clock } from "lucide-react";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Audit Log" };

export default async function AuditLogPage() {
  const supabase = createClient();

  let ctx;
  try {
    ctx = await getUserContext();
  } catch {
    redirect("/login");
  }

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  const actionBadge = (action: string) => {
    const map: Record<string, string> = {
      INSERT: "badge-success",
      UPDATE: "badge-info",
      ARCHIVE: "badge-warning",
      DELETE: "badge-danger",
      POST: "badge-info",
      APPROVE: "badge-success",
      REJECT: "badge-danger",
    };
    return map[action] ?? "badge";
  };

  return (
    <div className="page-container space-y-6">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-navy-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-navy-700" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="page-title">Audit Log</h1>
            <p className="page-subtitle">
              Immutable record of all system actions — last 200 entries
            </p>
          </div>
        </div>
      </div>

      {(!logs || logs.length === 0) ? (
        <div className="card p-12 text-center">
          <Clock className="w-10 h-10 text-ink-faint mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-ink-muted text-sm">No audit log entries yet.</p>
          <p className="text-ink-faint text-xs mt-1">
            Entries will appear here as users perform actions.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Time
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Action
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Table
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Record
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    User
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Role
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-ink-muted border-b border-surface-border">
                    Reason / Note
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-subtle transition-colors">
                    <td className="py-3 px-4 text-xs text-ink-muted font-mono whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={actionBadge(log.action)}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-ink">
                      {log.table_name}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-ink-muted max-w-[120px] truncate">
                      {log.record_id
                        ? log.record_id.slice(0, 8) + "…"
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-xs text-ink">
                      {log.user_email ?? log.user_id?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="py-3 px-4">
                      {log.user_role ? (
                        <span className="badge">{log.user_role}</span>
                      ) : (
                        <span className="text-ink-faint text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-ink-muted max-w-[200px] truncate">
                      {log.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-ink-faint">
        Showing latest 200 entries. Audit log entries cannot be edited or deleted.
      </p>
    </div>
  );
}
