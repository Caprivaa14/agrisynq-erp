import type { Metadata } from "next";
import { getUserContext } from "@/actions/context";
import { redirect } from "next/navigation";
import { getBatches, getExpiringBatches } from "@/actions/batches";
import BatchesClient from "./BatchesClient";

export const metadata: Metadata = { title: "Batch Register — Inventory" };

export default async function BatchesPage() {
  let ctx;
  try { ctx = await getUserContext(); }
  catch { redirect("/login"); }

  const [batches, expiringBatches] = await Promise.all([
    getBatches({ includeEmpty: false }),
    getExpiringBatches(30),
  ]);

  return (
    <BatchesClient
      initialBatches={batches as unknown as Parameters<typeof BatchesClient>[0]["initialBatches"]}
      expiringBatches={expiringBatches}
    />
  );
}
