import type { Metadata } from "next";
import { Sprout } from "lucide-react";

export const metadata: Metadata = {
  title: "Farmer Master — AgriSynq ERP",
};

export default function FarmersPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Farmer Master</h1>
          <p className="page-subtitle">Farmer KYC, farm details, and purchase history</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <Sprout className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 2</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Dedicated farmer records with masked Aadhaar, farm details, crop and season data, and full subsidised purchase history.</p>
        </div>
      </div>
    </div>
  );
}
