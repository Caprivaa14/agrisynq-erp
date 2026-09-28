// Units of Measure admin page — server component
// Reads seeded UoM library from Supabase; no add form (seeded at onboarding).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";
import { createClient } from "@/lib/supabase/server";
import { Info, Weight } from "lucide-react";

export const metadata: Metadata = { title: "Units of Measure" };

type UoM = {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  uom_type: string | null;
  base_unit: string | null;
  conversion_factor: number | null;
  gst_uom_code: string | null;
  is_system: boolean;
  is_active: boolean;
};

const TYPE_COLORS: Record<string, string> = {
  WEIGHT: "badge badge-navy",
  VOLUME: "badge badge-memo",
  COUNT:  "badge badge-green",
  LENGTH: "badge badge-gold",
};

export default async function UomPage() {
  let ctx;
  try {
    ctx = await getUserContext();
  } catch {
    redirect("/login");
  }

  const supabase = createClient();
  const { data: uoms } = await supabase
    .from("units_of_measure")
    .select("id,code,name,symbol,uom_type,base_unit,conversion_factor,gst_uom_code,is_system,is_active")
    .eq("tenant_id", ctx.tenantId)
    .order("uom_type", { ascending: true })
    .order("name", { ascending: true });

  const rows: UoM[] = uoms ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Units of Measure</h1>
          <p className="page-subtitle">Standard UoM library — seeded automatically during tenant onboarding</p>
        </div>
      </div>

      {/* Notice */}
      <div
        role="note"
        className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <span>
          Standard UoM library — seeded automatically during tenant onboarding. Custom UoMs can be
          added by your system administrator. Conversion factors are relative to the base unit shown.
        </span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Symbol</th>
                <th>Type</th>
                <th>Base Unit</th>
                <th>Conv. Factor</th>
                <th>GST Code</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Weight className="mx-auto mb-3 h-10 w-10 text-ink-faint" />
                    <p className="text-sm font-medium text-ink">No units of measure found</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      UoMs are seeded automatically at tenant setup.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id}>
                    <td className="font-mono font-medium text-navy-700">{u.code}</td>
                    <td className="font-medium text-ink">{u.name}</td>
                    <td className="text-ink-muted">{u.symbol ?? "—"}</td>
                    <td>
                      {u.uom_type ? (
                        <span className={TYPE_COLORS[u.uom_type] ?? "badge badge-gray"}>
                          {u.uom_type}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="text-ink-muted">{u.base_unit ?? "—"}</td>
                    <td className="text-right font-mono text-ink-muted">
                      {u.conversion_factor != null ? u.conversion_factor : "—"}
                    </td>
                    <td className="font-mono text-xs text-ink-muted">{u.gst_uom_code ?? "—"}</td>
                    <td>
                      {u.is_system ? (
                        <span className="badge badge-navy">System</span>
                      ) : (
                        <span className="badge badge-gray">Custom</span>
                      )}
                    </td>
                    <td>
                      {u.is_active ? (
                        <span className="badge badge-green">Active</span>
                      ) : (
                        <span className="badge badge-red">Inactive</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <div className="border-t border-surface-border px-4 py-3 text-xs text-ink-muted">
            {rows.length} unit{rows.length !== 1 ? "s" : ""} of measure
          </div>
        )}
      </div>
    </div>
  );
}
