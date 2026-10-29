import "server-only";
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

/** Abre un .p12 con su contraseña (tal cual, sin recortar) y extrae la clave y el certificado de firma. */
export function parseP12(der: Buffer, password: string): SigningCertificate {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(der.toString("binary"), false);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch {
    throw new Error("No se pudo abrir el archivo .p12. Verifica el archivo y la contraseña.");
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

    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
    const derBuffer = Buffer.from(certDer, "binary");
    const sha1 = forge.md.sha1.create();
    sha1.update(certDer);

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
