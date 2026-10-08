import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";

export const metadata: Metadata = { title: "Goods Receipt Notes — Purchases" };

export default async function GRNPage() {
  try { await getUserContext(); } catch { redirect("/login"); }
  return (
    <div className="max-w-4xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Goods Receipt Notes</h1>
          <p className="page-subtitle">GRN is generated automatically when a Purchase Invoice is Posted</p>
        </div>
      </div>
      <div className="card p-8 text-center">
        <p className="text-ink-muted text-sm">
          In FertiLedger ERP, GRN is embedded within the Purchase Invoice workflow.
          When you <strong>Post</strong> a Purchase Invoice, the system automatically:
        </p>
        <ul className="mt-4 text-sm text-ink-muted text-left max-w-md mx-auto space-y-2">
          <li className="flex items-start gap-2"><span className="text-leaf-600 font-bold">✓</span> Creates batch entries in the Batch Register</li>
          <li className="flex items-start gap-2"><span className="text-leaf-600 font-bold">✓</span> Posts GRN movement to the Stock Ledger</li>
          <li className="flex items-start gap-2"><span className="text-leaf-600 font-bold">✓</span> Updates available stock balance</li>
          <li className="flex items-start gap-2"><span className="text-leaf-600 font-bold">✓</span> Creates accounts payable entry</li>
        </ul>
        <div className="mt-6">
          <a href="/purchases/invoices" className="btn btn-primary">Go to Purchase Invoices →</a>
        </div>
      </div>
    </div>
  );
}
