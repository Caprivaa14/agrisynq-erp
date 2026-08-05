import type { Metadata } from "next";
import { ArrowLeftRight } from "lucide-react";

export const metadata: Metadata = {
  title: "C&F Withdrawals — AgriSynq ERP",
};

export default function CfWithdrawalsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">C&amp;F Withdrawals</h1>
          <p className="page-subtitle">Raise and track withdrawal requests from C&amp;F</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <ArrowLeftRight className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 3</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Submit withdrawal requests for C&amp;F-held stock. Track approval, delivery order generation, and gate pass issuance.</p>
        </div>
      </div>
    </div>
  );
}
