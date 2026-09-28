// Locations master-data page — server component
// Fetches data server-side and passes to LocationsClient for interactivity.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";
import { getLocations } from "@/actions/locations";
import LocationsClient from "./LocationsClient";

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsPage() {
  try {
    await getUserContext();
  } catch {
    redirect("/login");
  }

  const items = await getLocations();
  return <LocationsClient initialData={items} />;
}
