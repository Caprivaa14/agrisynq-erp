import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  Package, Users, ReceiptText, AlertCircle,
  TrendingUp, Boxes, FileCheck, RefreshCcw,
  ArrowUpRight, Clock,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard — FertiLedger ERP",
};

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "leaf",
  alert = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: "leaf" | "gold" | "navy" | "danger";
  alert?: boolean;
}) {
  const accentMap = {
    leaf:   "bg-leaf-50 text-leaf-600",
    gold:   "bg-gold-50 text-gold-600",
    navy:   "bg-navy-50 text-navy-700",
    danger: "bg-danger-50 text-danger-600",
  };

  return (
    <div className="stat-card flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${accentMap[accent]} shrink-0`}>
        <Icon className="w-5 h-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="stat-label">{label}</p>
        <p className={`stat-value ${alert ? "text-danger-600" : ""}`}>{value}</p>
        {sub && <p className="stat-sub">{sub}</p>}
      </div>
      {alert && (
        <AlertCircle className="w-4 h-4 text-danger-500 shrink-0 mt-1" />
      )}
    </div>
  );
}

// ─── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {action && (
        <a
          href={action}
          className="text-xs text-leaf-600 hover:text-leaf-700 flex items-center gap-1"
        >
          View all <ArrowUpRight className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────
export default async function DashboardPage() {
  // TODO: Replace with real DB queries once Phase 2 is complete
  const stats = {
    todaySales:       0,
    pendingDispatch:  0,
    overdueAR:        0,
    fmsExceptions:    0,
    physicalStock:    0,
    virtualStock:     0,
    expiringBatches:  0,
    activeLicences:   0,
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            FertiLedger ERP — Stock. Accounts. Compliance. Connected.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <Clock className="w-3.5 h-3.5" />
          <span>Live data</span>
        </div>
      </div>

      {/* ── Top KPI row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Today's Sales"
          value={formatCurrency(stats.todaySales)}
          sub="Tax invoices posted today"
          icon={ReceiptText}
          accent="leaf"
        />
        <StatCard
          label="Pending Dispatch"
          value={String(stats.pendingDispatch)}
          sub="Invoiced but not yet dispatched"
          icon={Boxes}
          accent="gold"
          alert={stats.pendingDispatch > 10}
        />
        <StatCard
          label="Overdue Receivables"
          value={formatCurrency(stats.overdueAR)}
          sub="Outstanding beyond credit days"
          icon={TrendingUp}
          accent="danger"
          alert={stats.overdueAR > 0}
        />
        <StatCard
          label="FMS Exceptions"
          value={String(stats.fmsExceptions)}
          sub="Unresolved reconciliation items"
          icon={RefreshCcw}
          accent={stats.fmsExceptions > 0 ? "danger" : "navy"}
          alert={stats.fmsExceptions > 0}
        />
      </div>

      {/* ── Stock reconciliation row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Virtual / Accounting Stock"
          value={`${stats.virtualStock} units`}
          sub="Based on posted invoices"
          icon={Package}
          accent="navy"
        />
        <StatCard
          label="Physical Stock"
          value={`${stats.physicalStock} units`}
          sub="Based on gate passes & DCs"
          icon={Boxes}
          accent="leaf"
        />
        <StatCard
          label="Expiring Batches (60 days)"
          value={String(stats.expiringBatches)}
          sub="Batches expiring within 60 days"
          icon={AlertCircle}
          accent={stats.expiringBatches > 0 ? "gold" : "navy"}
        />
      </div>

      {/* ── Two column: Quick links + Compliance status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Quick Actions */}
        <div className="card p-5">
          <SectionHeader title="Quick Actions" />
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "New Tax Invoice",     href: "/sales/invoices/new",          accent: "leaf" },
              { label: "New Purchase Order",  href: "/purchases/orders/new",         accent: "navy" },
              { label: "Record Receipt",      href: "/accounting/receipts/new",      accent: "gold" },
              { label: "Create Delivery Challan", href: "/sales/delivery-challans/new", accent: "navy" },
              { label: "New Goods Receipt",   href: "/purchases/grn/new",            accent: "leaf" },
              { label: "Import FMS Data",     href: "/fms/import",                   accent: "gold" },
            ].map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-surface-border text-sm text-ink hover:bg-surface-subtle hover:border-leaf-200 transition-colors"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-ink-faint shrink-0" />
                {a.label}
              </a>
            ))}
          </div>
        </div>

        {/* Compliance Status */}
        <div className="card p-5">
          <SectionHeader title="Compliance Status" />
          <div className="space-y-3">
            {[
              {
                label: "GST Period",
                status: "Open",
                color: "badge-green",
                detail: "July 2025 — GSTR-1 due 11 Aug",
              },
              {
                label: "FMS Reconciliation",
                status: "Pending",
                color: "badge-gold",
                detail: "2 unresolved exceptions",
              },
              {
                label: "Licences",
                status: `${stats.activeLicences} Active`,
                color: "badge-green",
                detail: "No licences expiring within 30 days",
              },
              {
                label: "Bank Reconciliation",
                status: "Not Started",
                color: "badge-gray",
                detail: "July 2025 statement not imported",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-start justify-between gap-4 py-2 border-b border-surface-border last:border-b-0"
              >
                <div>
                  <div className="text-sm font-medium text-ink">{item.label}</div>
                  <div className="text-xs text-ink-muted mt-0.5">{item.detail}</div>
                </div>
                <span className={`badge ${item.color} shrink-0`}>{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Setup notice — shown until Supabase is configured */}
      <div className="mt-6 border border-gold-200 bg-gold-50 rounded-lg px-5 py-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-gold-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-gold-800">
            Supabase not yet configured
          </p>
          <p className="text-sm text-gold-700 mt-0.5">
            Update <code className="font-mono text-xs bg-gold-100 px-1 py-0.5 rounded">.env.local</code> with your{" "}
            <strong>NEXT_PUBLIC_SUPABASE_URL</strong> and{" "}
            <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong>, then run the
            migration SQL files in{" "}
            <code className="font-mono text-xs bg-gold-100 px-1 py-0.5 rounded">supabase/migrations/</code>{" "}
            against your Supabase project to activate all features.
          </p>
        </div>
      </div>
    </div>
  );
}
