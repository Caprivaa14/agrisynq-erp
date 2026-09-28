import type { Metadata } from "next";
import { getUserContext } from "@/actions/context";
import { redirect } from "next/navigation";
import AdjustmentsClient from "./AdjustmentsClient";

export const metadata: Metadata = { title: "Stock Adjustments — Inventory" };

export default async function AdjustmentsPage() {
  let ctx;
  try { ctx = await getUserContext(); }
  catch { redirect("/login"); }

  return <AdjustmentsClient />;
}
