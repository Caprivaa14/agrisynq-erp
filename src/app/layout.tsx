import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgriSynq ERP",
  description:
    "Agricultural Trade, Inventory, Accounts & Compliance ERP. Stock. Accounts. Compliance. Connected.",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
