// Parties master-data page — server component
// Fetches data server-side and passes to PartiesClient for interactivity.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";
import { getParties } from "@/actions/parties";
import PartiesClient from "./PartiesClient";

export const metadata: Metadata = { title: "Parties" };

export default async function PartiesPage() {
  try {
    await getUserContext();
  } catch {
    redirect("/login");
  }

  const items = await getParties();
  return <PartiesClient initialData={items} />;
}
