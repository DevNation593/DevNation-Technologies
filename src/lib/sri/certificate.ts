import "server-only";
import { readFile } from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { daysUntilInEcuador } from "@/lib/admin/format";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "./crypto";
import { parseP12, type SigningCertificate } from "./p12";

export type { SigningCertificate };

/** De dónde sale la firma: subida en Configuración o variables SRI_P12_*. */
export type CertificateSource = "panel" | "env";

interface LoadedCertificate {
  source: CertificateSource;
  certificate: SigningCertificate;
}

// La clave de caché cambia con cada subida, así que todas las instancias del
// servidor toman la firma nueva en su siguiente petición.
let cached: { key: string; promise: Promise<LoadedCertificate> } | null = null;

async function readP12FromEnv(): Promise<Buffer> {
  const base64 = process.env.SRI_P12_BASE64?.trim();
  if (base64) return Buffer.from(base64, "base64");

  const path = process.env.SRI_P12_PATH?.trim();
  if (path) return readFile(path);

  throw new Error(
    "No hay firma electrónica configurada. Súbela en Configuración o define SRI_P12_PATH o SRI_P12_BASE64 y SRI_P12_PASSWORD.",
  );
}

async function loadFromEnv(): Promise<LoadedCertificate> {
  const certificate = parseP12(await readP12FromEnv(), process.env.SRI_P12_PASSWORD ?? "");
  return { source: "env", certificate };
}

async function loadFromDatabase(supabase: SupabaseClient): Promise<LoadedCertificate> {
  const { data, error } = await supabase
    .from("sri_certificates")
    .select("p12_encrypted, password_encrypted")
    .eq("id", 1)
    .single();
  if (error || !data) throw new Error("No se pudo leer la firma electrónica guardada.");

  const der = decryptSecret(data.p12_encrypted, "sri_certificates.p12");
  const password = decryptSecret(data.password_encrypted, "sri_certificates.password").toString("utf8");
  return { source: "panel", certificate: parseP12(der, password) };
}

async function getLoadedCertificate(): Promise<LoadedCertificate> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sri_certificates").select("uploaded_at").eq("id", 1).maybeSingle();
  if (error) throw new Error("No se pudo consultar la firma electrónica guardada.");

  const key = data ? `db:${data.uploaded_at}` : "env";
  if (cached?.key !== key) {
    const promise: Promise<LoadedCertificate> = (data ? loadFromDatabase(supabase) : loadFromEnv()).catch(
      (loadError) => {
        if (cached?.promise === promise) cached = null;
        throw loadError;
      },
    );
    cached = { key, promise };
  }
  return cached.promise;
}

export async function getSigningCertificate(): Promise<SigningCertificate> {
  return (await getLoadedCertificate()).certificate;
}

export async function getCertificateStatus() {
  try {
    const { source, certificate } = await getLoadedCertificate();
    const validTo = certificate.validTo.toISOString();
    const daysLeft = daysUntilInEcuador(validTo);
    return {
      configured: true as const,
      source,
      subject: certificate.subject,
      issuer: certificate.issuer,
      validFrom: certificate.validFrom.toISOString(),
      validTo,
      daysLeft,
      // Caduca a una hora concreta: el mismo día del vencimiento ya puede estar caducada.
      expired: certificate.validTo.getTime() < Date.now(),
      expiresSoon: daysLeft <= 30,
    };
  } catch (error) {
    return { configured: false as const, error: (error as Error).message };
  }
}
