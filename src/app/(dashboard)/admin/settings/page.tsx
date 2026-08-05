import type { Metadata } from "next";
import { Settings } from "lucide-react";

export const metadata: Metadata = {
  title: "Settings — AgriSynq ERP",
};

export default function SettingsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Organisation, branch, and system configuration</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <Settings className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 10</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Configure organisation details, branch settings, invoice series, financial year, GST registration details, and FMS settings.</p>
        </div>
      </div>
    </div>
  );
}
