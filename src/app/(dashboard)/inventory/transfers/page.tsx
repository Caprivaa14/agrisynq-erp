import type { Metadata } from "next";
import { getUserContext } from "@/actions/context";
import { redirect } from "next/navigation";
import TransferClient from "./TransferClient";

export const metadata: Metadata = { title: "Stock Transfers — Inventory" };

export default async function TransferPage() {
  let ctx;
  try { ctx = await getUserContext(); }
  catch { redirect("/login"); }

  return <TransferClient />;
}
