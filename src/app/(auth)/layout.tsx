import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — AgriSynq ERP",
  description: "Sign in to AgriSynq ERP",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center p-4">
      {children}
    </div>
  );
}
