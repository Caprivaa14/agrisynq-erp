import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";
import { getFarmerSales } from "@/actions/farmer-sales";
import FarmerSalesClient from "./FarmerSalesClient";

export const metadata: Metadata = { title: "Farmer Sales — Sales" };

export default async function FarmerSalesPage() {
  try { await getUserContext(); } catch { redirect("/login"); }
  const sales = await getFarmerSales();
  return <FarmerSalesClient initialSales={sales as unknown as Parameters<typeof FarmerSalesClient>[0]["initialSales"]} />;
}
