// Tax Profiles (GST Rate Master) admin page — server component
// Fetches data server-side and passes to TaxProfilesClient.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";
import { getTaxProfiles } from "@/actions/tax-profiles";
import TaxProfilesClient from "./TaxProfilesClient";

export const metadata: Metadata = { title: "Tax Profiles — GST Rate Master" };

export default async function TaxProfilesPage() {
  try {
    await getUserContext();
  } catch {
    redirect("/login");
  }

  const items = await getTaxProfiles();
  return <TaxProfilesClient initialData={items} />;
}
