import "server-only";
import { readFile } from "node:fs/promises";
import forge from "node-forge";

export interface SigningCertificate {
  privateKey: forge.pki.rsa.PrivateKey;
  /** Certificado DER en base64, en una sola línea. */
  certificateBase64: string;
  /** SHA-1 del certificado DER, en base64. */
  certificateDigest: string;
  issuerName: string;
  serialNumber: string;
  modulus: string;
  exponent: string;
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
}

let cached: Promise<SigningCertificate> | null = null;

function bigIntegerToBase64(value: forge.jsbn.BigInteger): string {
  let hex = value.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  return Buffer.from(hex, "hex").toString("base64");
}

function distinguishedName(attributes: forge.pki.CertificateField[]): string {
  return [...attributes]
    .reverse()
    .map((a) => `${a.shortName ?? a.type}=${a.value}`)
    .join(",");
}

function readableName(attributes: forge.pki.CertificateField[]): string {
  const cn = attributes.find((a) => a.shortName === "CN")?.value;
  return String(cn ?? distinguishedName(attributes));
}

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
  const p12Der = await readP12();
  const password = process.env.SRI_P12_PASSWORD ?? "";

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(p12Der.toString("binary"), false);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch {
    throw new Error("No se pudo abrir el archivo .p12. Verifica el archivo y SRI_P12_PASSWORD.");
  }

  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];

  // Algunos .p12 (p. ej. del Banco Central) incluyen varios certificados de la
  // cadena: se usa el que corresponde a la clave privada.
  for (const keyBag of keyBags) {
    const privateKey = keyBag.key as forge.pki.rsa.PrivateKey | undefined;
    if (!privateKey?.n) continue;

    const certificate = certBags
      .map((bag) => bag.cert)
      .find((cert): cert is forge.pki.Certificate => {
        const publicKey = cert?.publicKey as forge.pki.rsa.PublicKey | undefined;
        return Boolean(publicKey?.n && publicKey.n.equals(privateKey.n));
      });
    if (!certificate) continue;

    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
    const derBuffer = Buffer.from(der, "binary");
    const sha1 = forge.md.sha1.create();
    sha1.update(der);

    return {
      privateKey,
      certificateBase64: derBuffer.toString("base64"),
      certificateDigest: Buffer.from(sha1.digest().getBytes(), "binary").toString("base64"),
      issuerName: distinguishedName(certificate.issuer.attributes),
      serialNumber: BigInt(`0x${certificate.serialNumber}`).toString(10),
      modulus: bigIntegerToBase64(privateKey.n),
      exponent: bigIntegerToBase64(privateKey.e),
      subject: readableName(certificate.subject.attributes),
      issuer: readableName(certificate.issuer.attributes),
      validFrom: certificate.validity.notBefore,
      validTo: certificate.validity.notAfter,
    };
  }

  throw new Error("El archivo .p12 no contiene una clave privada RSA con su certificado.");
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
