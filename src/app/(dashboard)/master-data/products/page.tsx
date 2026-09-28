// Products master-data page — server component
// Fetches data server-side and passes to ProductsClient for interactivity.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserContext } from "@/actions/context";
import { getProducts } from "@/actions/products";
import ProductsClient from "./ProductsClient";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  try {
    await getUserContext();
  } catch {
    redirect("/login");
  }

  const items = await getProducts();
  return <ProductsClient initialData={items} />;
}
