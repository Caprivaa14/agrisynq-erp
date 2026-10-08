import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";
import { getPurchaseOrders } from "@/actions/purchase-orders";
import PurchaseOrdersClient from "./PurchaseOrdersClient";

export const metadata: Metadata = { title: "Purchase Orders — Purchases" };

export default async function PurchaseOrdersPage() {
  try { await getUserContext(); } catch { redirect("/login"); }
  const orders = await getPurchaseOrders();
  return <PurchaseOrdersClient initialOrders={orders as unknown as Parameters<typeof PurchaseOrdersClient>[0]["initialOrders"]} />;
}
