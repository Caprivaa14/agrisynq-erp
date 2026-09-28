import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";
import { getParties } from "@/actions/parties";
import PartiesClient from "./PartiesClient";

export const metadata: Metadata = { title: "Parties" };

export default async function PartiesPage() {
  // getUserContext() only throws when NOT authenticated.
  // If migrations aren't applied yet it returns a placeholder context
  // and getParties() will return [] — the empty state is shown instead.
  try {
    await getUserContext();
  } catch {
    redirect("/login");
  }

  const items = await getParties();
  return <PartiesClient initialData={items} />;
}
