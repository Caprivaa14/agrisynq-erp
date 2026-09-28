import type { Metadata } from "next";
import { getUserContext } from "@/actions/context";
import { redirect } from "next/navigation";
import { getStockBalance } from "@/actions/stock-ledger";
import StockLedgerClient from "./StockLedgerClient";

export const metadata: Metadata = { title: "Stock Ledger — Inventory" };

export default async function StockLedgerPage() {
  let ctx;
  try { ctx = await getUserContext(); }
  catch { redirect("/login"); }

  const balance = await getStockBalance();
  return <StockLedgerClient initialBalance={balance as unknown as Parameters<typeof StockLedgerClient>[0]["initialBalance"]} />;
}
