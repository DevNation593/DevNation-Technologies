import type { Metadata } from "next";
import PageHeader from "@/components/admin/PageHeader";
import { requireAdmin } from "@/lib/admin/auth";
import { listProducts } from "@/lib/admin/queries";
import ProductsManager from "./ProductsManager";

export const metadata: Metadata = { title: "Productos" };

export default async function ProductsPage() {
  await requireAdmin();
  const products = await listProducts();
  return (
    <>
      <PageHeader title="Productos" />
      <div className="adm-content">
        <ProductsManager products={products} />
      </div>
    </>
  );
}
