import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";
import { getQuotations } from "@/actions/sales-orders";
import QuotationsClient from "./QuotationsClient";

export const metadata: Metadata = { title: "Quotations — Sales" };

export default async function QuotationsPage() {
  try { await getUserContext(); } catch { redirect("/login"); }
  const quotations = await getQuotations();
  return <QuotationsClient initialQuotations={quotations as unknown as Parameters<typeof QuotationsClient>[0]["initialQuotations"]} />;
}
