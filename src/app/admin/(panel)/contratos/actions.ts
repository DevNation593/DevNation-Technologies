"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin/auth";
import { contractKinds } from "@/lib/admin/contract-template";
import { todayInEcuador } from "@/lib/admin/format";
import { actionError, nextNumber, number, text, upsertClient, type ActionResult } from "@/lib/admin/server";
import type { ContractData, ContractKind, ContractStatus } from "@/lib/admin/types";

const STATUSES: ContractStatus[] = ["borrador", "enviado", "firmado", "finalizado", "anulado"];

export interface ContractInput {
  kind: ContractKind;
  status: ContractStatus;
  contract_date: string;
  data: ContractData;
}

function sanitizeData(data: ContractData): ContractData {
  const clauses = data.clauses ?? ({} as ContractData["clauses"]);
  return {
    city: text(data.city, 200),
    provider: text(data.provider, 300),
    providerId: text(data.providerId, 20),
    providerRep: text(data.providerRep, 200),
    providerAddress: text(data.providerAddress, 300),
    providerEmail: text(data.providerEmail, 200),
    client: text(data.client, 300),
    clientId: text(data.clientId, 20),
    clientRep: text(data.clientRep, 200),
    clientAddress: text(data.clientAddress, 300),
    clientEmail: text(data.clientEmail, 200),
    project: text(data.project, 300),
    scope: text(data.scope, 10000),
    price: number(data.price, 0, 100_000_000),
    months: Math.round(number(data.months, 1, 600)),
    payment: text(data.payment, 2000),
    schedule: text(data.schedule, 4000),
    sla: text(data.sla, 4000),
    notice: Math.round(number(data.notice, 0, 3650)),
    clauses: {
      ip: Boolean(clauses.ip),
      privacy: Boolean(clauses.privacy),
      confidential: Boolean(clauses.confidential),
      warranty: Boolean(clauses.warranty),
      termination: Boolean(clauses.termination),
      force: Boolean(clauses.force),
      disputes: Boolean(clauses.disputes),
    },
    customTitle: text(data.customTitle, 200),
    customText: text(data.customText, 10000),
  };
}

export async function saveContract(
  id: string | null,
  input: ContractInput,
): Promise<ActionResult<{ id: string; number: string }>> {
  try {
    const supabase = await adminClient();
    const data = sanitizeData(input.data);
    const contractDate = /^\d{4}-\d{2}-\d{2}$/.test(input.contract_date) ? input.contract_date : todayInEcuador();
    const client_id = await upsertClient(supabase, {
      name: data.client,
      identification: data.clientId,
      email: data.clientEmail,
      phone: "",
      address: data.clientAddress,
      legalRepresentative: data.clientRep,
    });

    const row = {
      kind: contractKinds.some((k) => k.value === input.kind) ? input.kind : "software",
      status: STATUSES.includes(input.status) ? input.status : "borrador",
      contract_date: contractDate,
      data,
      total: data.price,
      client_id,
    };

    if (id) {
      const { data: saved, error } = await supabase
        .from("contracts")
        .update(row)
        .eq("id", id)
        .select("id, number")
        .single();
      if (error) throw error;
      revalidatePath("/admin/contratos");
      return { ok: true, id: saved.id, number: saved.number };
    }

    const year = contractDate.slice(0, 4);
    const seq = await nextNumber(supabase, `contrato:${year}`);
    const { data: saved, error } = await supabase
      .from("contracts")
      .insert({ ...row, number: `DN-CT-${year}-${String(seq).padStart(4, "0")}` })
      .select("id, number")
      .single();
    if (error) throw error;
    revalidatePath("/admin/contratos");
    return { ok: true, id: saved.id, number: saved.number };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteContract(id: string): Promise<ActionResult<object>> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.from("contracts").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/contratos");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
