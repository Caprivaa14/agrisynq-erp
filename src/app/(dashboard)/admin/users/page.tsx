import type { Metadata } from "next";
import { Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Users & Roles — AgriSynq ERP",
};

export default function UsersPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users &amp; Roles</h1>
          <p className="page-subtitle">User management and role-based access control</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <Shield className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 10</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Manage ERP users, assign roles, and configure branch and warehouse access restrictions. Maker-checker approval roles managed here.</p>
        </div>
      </div>
    </div>
  );
}
