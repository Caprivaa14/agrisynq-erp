import type { Metadata } from "next";
import { FilePlus2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Import FMS Data — AgriSynq ERP",
};

export default function FmsImportPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Import FMS Data</h1>
          <p className="page-subtitle">Upload FMS, iFMS, and PoS transaction files</p>
        </div>
      </div>
      <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[320px] gap-4">
        <div className="p-4 rounded-2xl bg-surface-subtle">
          <FilePlus2 className="w-8 h-8 text-ink-faint" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Coming in Phase 8</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">Import CSV or Excel files downloaded from the FMS/iFMS portal. Validates headers, extracts only the last 4 Aadhaar digits, and queues automated matching.</p>
        </div>
      </div>
    </div>
  );
}
