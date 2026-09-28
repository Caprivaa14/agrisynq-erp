// Licences master-data page — server component
// Fetches data server-side and passes to LicencesClient for interactivity.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";
import { getLicences } from "@/actions/licences";
import LicencesClient from "./LicencesClient";

export const metadata: Metadata = { title: "Licences" };

export default async function LicencesPage() {
  try {
    await getUserContext();
  } catch {
    redirect("/login");
  }

  const items = await getLicences();
  return <LicencesClient initialData={items} />;
}
