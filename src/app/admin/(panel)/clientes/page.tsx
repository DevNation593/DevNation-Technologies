import type { Metadata } from "next";
import PageHeader from "@/components/admin/PageHeader";
import { requireAdmin } from "@/lib/admin/auth";
import { listClients } from "@/lib/admin/queries";
import ClientsManager from "./ClientsManager";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage() {
  await requireAdmin();
  const clients = await listClients();
  return (
    <>
      <PageHeader title="Clientes" />
      <div className="adm-content">
        <ClientsManager clients={clients} />
      </div>
    </>
  );
}
