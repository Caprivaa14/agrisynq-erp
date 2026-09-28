// Farmers master-data page — server component
// Fetches data server-side and passes to FarmersClient for interactivity.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";
import { getFarmers } from "@/actions/farmers";
import FarmersClient from "./FarmersClient";

export const metadata: Metadata = { title: "Farmers" };

export default async function FarmersPage() {
  try {
    await getUserContext();
  } catch {
    redirect("/login");
  }

  const items = await getFarmers();
  return <FarmersClient initialData={items} />;
}
