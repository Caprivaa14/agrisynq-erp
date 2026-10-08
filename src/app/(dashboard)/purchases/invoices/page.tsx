import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";
import { getPurchaseInvoices, getSupplierPayables } from "@/actions/purchase-invoices";
import PurchaseInvoicesClient from "./PurchaseInvoicesClient";

export const metadata: Metadata = { title: "Purchase Invoices — Purchases" };

export default async function PurchaseInvoicesPage() {
  try { await getUserContext(); } catch { redirect("/login"); }
  const [invoices, payables] = await Promise.all([
    getPurchaseInvoices(),
    getSupplierPayables(),
  ]);
  return <PurchaseInvoicesClient initialInvoices={invoices as unknown as Parameters<typeof PurchaseInvoicesClient>[0]["initialInvoices"]} supplierPayables={payables} />;
}
