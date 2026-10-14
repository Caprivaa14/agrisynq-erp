import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";
import { getCreditNotes } from "@/actions/credit-notes";
import CreditNotesClient from "./CreditNotesClient";

export const metadata: Metadata = { title: "Credit Notes — Sales" };

export default async function CreditNotesPage() {
  try { await getUserContext(); } catch { redirect("/login"); }
  const notes = await getCreditNotes();
  return <CreditNotesClient initialNotes={notes as unknown as Parameters<typeof CreditNotesClient>[0]["initialNotes"]} />;
}
