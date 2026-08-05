import type { Metadata } from "next";
import { Banknote } from "lucide-react";

export const metadata: Metadata = {
  title: "Settlements & Bonds — AgriSynq ERP",
};

export default function SettlementsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settlements &amp; Bonds</h1>
          <p className="page-subtitle">Bond register, security deposits, and settlement instruments</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <Banknote className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 6</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Manage bonds, security deposits, and settlement instruments. Track issuance, balance, utilisation, and expiry for each instrument.</p>
        </div>
      </div>
    </div>
  );
}
