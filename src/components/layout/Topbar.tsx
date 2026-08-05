"use client";

import { usePathname } from "next/navigation";
import { signOutAction } from "@/actions/auth";
import { Bell, LogOut, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Build a readable breadcrumb from the URL pathname
function buildBreadcrumbs(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return ["Dashboard"];

  const labels: Record<string, string> = {
    "master-data":   "Master Data",
    "parties":       "Parties",
    "farmers":       "Farmers",
    "products":      "Products",
    "locations":     "Locations",
    "licences":      "Licences",
    "purchases":     "Purchases",
    "orders":        "Orders",
    "grn":           "Goods Receipts",
    "invoices":      "Invoices",
    "memo":          "Memo",
    "cf-management": "C&F Management",
    "stock":         "Stock",
    "withdrawals":   "Withdrawals",
    "gate-passes":   "Gate Passes",
    "sales":         "Sales",
    "quotations":    "Quotations",
    "delivery-challans": "Delivery Challans",
    "credit-notes":  "Credit / Debit Notes",
    "inventory":     "Inventory",
    "ledger":        "Ledger",
    "batches":       "Batches",
    "transfers":     "Transfers",
    "adjustments":   "Adjustments",
    "accounting":    "Accounting",
    "accounts":      "Accounts",
    "vouchers":      "Vouchers",
    "receipts":      "Receipts",
    "settlements":   "Settlements",
    "ar":            "AR — Receivables",
    "ap":            "AP — Payables",
    "trial-balance": "Trial Balance",
    "gst":           "GST",
    "sales-register":   "Sales Register",
    "purchase-register":"Purchase Register",
    "gstr1":         "GSTR-1",
    "gstr3b":        "GSTR-3B",
    "gstr2b":        "GSTR-2B Reconciliation",
    "fms":           "FMS Compliance",
    "import":        "Import FMS Data",
    "reconciliation":"Reconciliation",
    "reissue":       "Cancel & Reissue",
    "bank":          "Bank",
    "statements":    "Statements",
    "reports":       "Reports",
    "admin":         "Administration",
    "users":         "Users & Roles",
    "audit":         "Audit Log",
    "periods":       "Period Locks",
    "settings":      "Settings",
  };

  return segments.map((s) => labels[s] ?? s);
}

export default function Topbar() {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname);

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30",
        "left-[var(--sidebar-width)]",
        "h-[var(--topbar-height)]",
        "bg-surface-card border-b border-surface-border",
        "flex items-center justify-between px-6",
        "shadow-[0_1px_0_0_rgba(0,0,0,0.05)]"
      )}
    >
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight className="w-3.5 h-3.5 text-ink-faint" />
              )}
              <span
                className={cn(
                  i === crumbs.length - 1
                    ? "font-medium text-ink"
                    : "text-ink-muted"
                )}
              >
                {crumb}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button
          id="btn-notifications"
          aria-label="Notifications"
          className="relative p-2 rounded-md text-ink-muted hover:bg-surface-subtle hover:text-ink transition-colors"
        >
          <Bell className="w-4.5 h-4.5" strokeWidth={1.75} />
          {/* Unread dot — placeholder */}
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-gold-500" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-surface-border mx-1" />

        {/* Sign out */}
        <form action={signOutAction}>
          <button
            id="btn-signout"
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-ink-muted hover:text-danger-600 hover:bg-danger-50 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
