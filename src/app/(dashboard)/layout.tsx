import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export const metadata: Metadata = {
  title: { template: "%s — FertiLedger ERP", default: "FertiLedger ERP" },
  description:
    "Agricultural Trade, Inventory, Accounts & Compliance ERP — Stock. Accounts. Compliance. Connected.",
};

/**
 * Dashboard shell layout — rendered on every authenticated page.
 * Server component: validates session before rendering.
 * Unauthenticated users are redirected to /login by middleware,
 * but we double-check here for defence in depth.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-surface-bg">
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Fixed topbar — positioned to the right of sidebar */}
      <Topbar />

      {/* Main content area */}
      <main
        className="flex-1"
        style={{
          marginLeft: "var(--sidebar-width)",
          marginTop: "var(--topbar-height)",
          minHeight: "calc(100vh - var(--topbar-height))",
          padding: "1.5rem",
        }}
      >
        {children}
      </main>
    </div>
  );
}
