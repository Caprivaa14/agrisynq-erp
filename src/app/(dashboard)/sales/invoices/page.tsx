import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";
import { getSalesInvoices, getCustomerReceivables } from "@/actions/sales-invoices";
import SalesInvoicesClient from "./SalesInvoicesClient";

export const metadata: Metadata = { title: "Tax Invoices — Sales" };

export default async function SalesInvoicesPage() {
  try { await getUserContext(); } catch { redirect("/login"); }
  const [invoices, receivables] = await Promise.all([getSalesInvoices(), getCustomerReceivables()]);
  return <SalesInvoicesClient
    initialInvoices={invoices as unknown as Parameters<typeof SalesInvoicesClient>[0]["initialInvoices"]}
    customerReceivables={receivables}
  />;
}
