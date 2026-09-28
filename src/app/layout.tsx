import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "FertiLedger ERP",
  description:
    "Agricultural Trade, Inventory, Accounts & Compliance ERP — Stock. Accounts. Compliance. Connected.",
  icons: { icon: "/favicon.png" },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
