import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Campo al que pertenece cada valor cifrado; va como AAD para que no se puedan intercambiar. */
export type SecretPurpose = "sri_certificates.p12" | "sri_certificates.password";

const VERSION = "v1:";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function encryptionKey(): Buffer {
  const key = Buffer.from(process.env.SRI_ENCRYPTION_KEY?.trim() ?? "", "base64");
  if (key.length !== 32) {
    throw new Error("Falta SRI_ENCRYPTION_KEY (32 bytes en base64) en las variables del servidor.");
  }
  return key;
}

/** Cifra con AES-256-GCM. Formato: "v1:" + base64(iv | tag | texto cifrado). */
export function encryptSecret(plain: Buffer, purpose: SecretPurpose): string {
  const key = encryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_LENGTH });
  cipher.setAAD(Buffer.from(purpose));
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return VERSION + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decryptSecret(value: string, purpose: SecretPurpose): Buffer {
  const key = encryptionKey();
  try {
    if (!value.startsWith(VERSION)) throw new Error("Formato desconocido");
    const data = Buffer.from(value.slice(VERSION.length), "base64");
    if (data.length < IV_LENGTH + TAG_LENGTH) throw new Error("Datos incompletos");
    const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, IV_LENGTH), {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH));
    return Buffer.concat([decipher.update(data.subarray(IV_LENGTH + TAG_LENGTH)), decipher.final()]);
  } catch {
    throw new Error(
      "No se pudo descifrar la firma electrónica. Verifica SRI_ENCRYPTION_KEY o vuelve a subir la firma.",
    );
  }
}
