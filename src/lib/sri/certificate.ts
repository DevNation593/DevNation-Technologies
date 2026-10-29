import "server-only";
import { readFile } from "node:fs/promises";
import { parseP12, type SigningCertificate } from "./p12";

export type { SigningCertificate };

let cached: Promise<SigningCertificate> | null = null;

async function readP12(): Promise<Buffer> {
  const base64 = process.env.SRI_P12_BASE64?.trim();
  if (base64) return Buffer.from(base64, "base64");

  const path = process.env.SRI_P12_PATH?.trim();
  if (path) return readFile(path);

  throw new Error(
    "No hay firma electrónica configurada. Define SRI_P12_PATH o SRI_P12_BASE64 y SRI_P12_PASSWORD.",
  );
}

async function loadCertificate(): Promise<SigningCertificate> {
  return parseP12(await readP12(), process.env.SRI_P12_PASSWORD ?? "");
}

export function getSigningCertificate(): Promise<SigningCertificate> {
  if (!cached) {
    cached = loadCertificate().catch((error) => {
      cached = null;
      throw error;
    });
  }
  return cached;
}

export async function getCertificateStatus() {
  try {
    const cert = await getSigningCertificate();
    return {
      configured: true as const,
      subject: cert.subject,
      issuer: cert.issuer,
      validTo: cert.validTo.toISOString(),
      expired: cert.validTo.getTime() < Date.now(),
      expiresSoon: cert.validTo.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000,
    };
  } catch (error) {
    return { configured: false as const, error: (error as Error).message };
  }
}
