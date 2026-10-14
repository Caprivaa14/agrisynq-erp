import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";
import { getSalesOrders } from "@/actions/sales-orders";
import SalesOrdersClient from "./SalesOrdersClient";

export const metadata: Metadata = { title: "Sales Orders — Sales" };

export default async function SalesOrdersPage() {
  try { await getUserContext(); } catch { redirect("/login"); }
  const orders = await getSalesOrders();
  return <SalesOrdersClient initialOrders={orders as unknown as Parameters<typeof SalesOrdersClient>[0]["initialOrders"]} />;
}
