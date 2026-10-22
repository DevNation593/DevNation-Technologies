import "server-only";
import { createHash, randomInt } from "node:crypto";
import forge from "node-forge";
import type { SigningCertificate } from "./certificate";

// Firma XAdES-BES (RSA-SHA1, C14N inclusivo) exigida por el SRI.
//
// Los elementos firmados se construyen ya en forma canónica. Al canonicalizar
// un subconjunto del documento, C14N agrega al elemento raíz del subconjunto
// los namespaces heredados de <ds:Signature>, por eso se insertan NS_DECL antes
// de calcular cada digest.

const DS = "http://www.w3.org/2000/09/xmldsig#";
const ETSI = "http://uri.etsi.org/01903/v1.3.2#";
const NS_DECL = `xmlns:ds="${DS}" xmlns:etsi="${ETSI}"`;
const SHA1 = "http://www.w3.org/2000/09/xmldsig#sha1";

function sha1Base64(content: string): string {
  return createHash("sha1").update(content, "utf8").digest("base64");
}

function withNamespaces(element: string, tagName: string): string {
  return element.replace(`<${tagName} `, `<${tagName} ${NS_DECL} `);
}

function ecuadorTimestamp(date = new Date()): string {
  const local = new Date(date.getTime() - 5 * 60 * 60 * 1000);
  return `${local.toISOString().slice(0, 19)}-05:00`;
}

/**
 * Firma el comprobante (elemento raíz con id="comprobante") y devuelve el
 * documento completo con declaración XML.
 */
export function signInvoiceXml(comprobante: string, cert: SigningCertificate, signingDate = new Date()): string {
  const rootMatch = /^<([a-zA-Z]+)[\s>]/.exec(comprobante);
  if (!rootMatch || !comprobante.includes('id="comprobante"')) {
    throw new Error("El comprobante debe tener un elemento raíz con id=\"comprobante\".");
  }
  const rootTag = rootMatch[1];

  const n = () => String(randomInt(100000, 999999));
  const signatureId = `Signature${n()}`;
  const signedInfoId = `Signature-SignedInfo${n()}`;
  const signedPropertiesId = `${signatureId}-SignedProperties${n()}`;
  const signedPropertiesRefId = `SignedPropertiesID${n()}`;
  const referenceId = `Reference-ID-${n()}`;
  const certificateId = `Certificate${n()}`;
  const signatureValueId = `SignatureValue${n()}`;
  const objectId = `${signatureId}-Object${n()}`;

  const signedProperties =
    `<etsi:SignedProperties Id="${signedPropertiesId}">` +
    `<etsi:SignedSignatureProperties>` +
    `<etsi:SigningTime>${ecuadorTimestamp(signingDate)}</etsi:SigningTime>` +
    `<etsi:SigningCertificate><etsi:Cert><etsi:CertDigest>` +
    `<ds:DigestMethod Algorithm="${SHA1}"></ds:DigestMethod>` +
    `<ds:DigestValue>${cert.certificateDigest}</ds:DigestValue>` +
    `</etsi:CertDigest><etsi:IssuerSerial>` +
    `<ds:X509IssuerName>${escapeXml(cert.issuerName)}</ds:X509IssuerName>` +
    `<ds:X509SerialNumber>${cert.serialNumber}</ds:X509SerialNumber>` +
    `</etsi:IssuerSerial></etsi:Cert></etsi:SigningCertificate>` +
    `</etsi:SignedSignatureProperties>` +
    `<etsi:SignedDataObjectProperties>` +
    `<etsi:DataObjectFormat ObjectReference="#${referenceId}">` +
    `<etsi:Description>contenido comprobante</etsi:Description>` +
    `<etsi:MimeType>text/xml</etsi:MimeType>` +
    `</etsi:DataObjectFormat></etsi:SignedDataObjectProperties>` +
    `</etsi:SignedProperties>`;

  const keyInfo =
    `<ds:KeyInfo Id="${certificateId}">` +
    `<ds:X509Data><ds:X509Certificate>${cert.certificateBase64}</ds:X509Certificate></ds:X509Data>` +
    `<ds:KeyValue><ds:RSAKeyValue><ds:Modulus>${cert.modulus}</ds:Modulus>` +
    `<ds:Exponent>${cert.exponent}</ds:Exponent></ds:RSAKeyValue></ds:KeyValue>` +
    `</ds:KeyInfo>`;

  const signedPropertiesDigest = sha1Base64(withNamespaces(signedProperties, "etsi:SignedProperties"));
  const keyInfoDigest = sha1Base64(withNamespaces(keyInfo, "ds:KeyInfo"));
  // La transformación enveloped-signature excluye la firma: el digest es el del comprobante original.
  const comprobanteDigest = sha1Base64(comprobante);

  const signedInfo =
    `<ds:SignedInfo Id="${signedInfoId}">` +
    `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></ds:CanonicalizationMethod>` +
    `<ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></ds:SignatureMethod>` +
    `<ds:Reference Id="${signedPropertiesRefId}" Type="http://uri.etsi.org/01903#SignedProperties" URI="#${signedPropertiesId}">` +
    `<ds:DigestMethod Algorithm="${SHA1}"></ds:DigestMethod>` +
    `<ds:DigestValue>${signedPropertiesDigest}</ds:DigestValue>` +
    `</ds:Reference>` +
    `<ds:Reference URI="#${certificateId}">` +
    `<ds:DigestMethod Algorithm="${SHA1}"></ds:DigestMethod>` +
    `<ds:DigestValue>${keyInfoDigest}</ds:DigestValue>` +
    `</ds:Reference>` +
    `<ds:Reference Id="${referenceId}" URI="#comprobante">` +
    `<ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></ds:Transform></ds:Transforms>` +
    `<ds:DigestMethod Algorithm="${SHA1}"></ds:DigestMethod>` +
    `<ds:DigestValue>${comprobanteDigest}</ds:DigestValue>` +
    `</ds:Reference>` +
    `</ds:SignedInfo>`;

  const md = forge.md.sha1.create();
  md.update(withNamespaces(signedInfo, "ds:SignedInfo"), "utf8");
  const signatureValue = Buffer.from(cert.privateKey.sign(md), "binary").toString("base64");

  const signature =
    `<ds:Signature ${NS_DECL} Id="${signatureId}">` +
    signedInfo +
    `<ds:SignatureValue Id="${signatureValueId}">${signatureValue}</ds:SignatureValue>` +
    keyInfo +
    `<ds:Object Id="${objectId}"><etsi:QualifyingProperties Target="#${signatureId}">` +
    signedProperties +
    `</etsi:QualifyingProperties></ds:Object>` +
    `</ds:Signature>`;

  const closing = `</${rootTag}>`;
  const signed = comprobante.slice(0, -closing.length) + signature + closing;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${signed}`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
