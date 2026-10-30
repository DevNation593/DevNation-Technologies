import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  XmlBufferInputProvider,
  XmlDocument,
  XmlValidateError,
  XsdValidator,
  xmlRegisterInputProvider,
} from "libxml2-wasm";

// Esquemas de la ficha técnica del SRI. Se incluyen en el despliegue mediante
// outputFileTracingIncludes en next.config.ts.
const XSD_DIR = path.join(process.cwd(), "src", "lib", "sri", "xsd");
const INVOICE_XSD = "factura_V1.1.0.xsd";
const DSIG_XSD = "xmldsig-core-schema.xsd";
const MAX_ERRORS = 5;

let validator: Promise<XsdValidator> | null = null;

async function loadValidator(): Promise<XsdValidator> {
  const [invoiceXsd, dsigXsd] = await Promise.all([
    readFile(path.join(XSD_DIR, INVOICE_XSD)),
    readFile(path.join(XSD_DIR, DSIG_XSD)),
  ]);
  // El XSD de la factura importa el de la firma por nombre de archivo.
  xmlRegisterInputProvider(new XmlBufferInputProvider({ [DSIG_XSD]: dsigXsd }));
  // El documento del esquema no se libera: el validador lo referencia y se
  // conserva en memoria durante toda la vida del proceso.
  return XsdValidator.fromDoc(XmlDocument.fromBuffer(invoiceXsd, { url: INVOICE_XSD }));
}

function getValidator(): Promise<XsdValidator> {
  validator ??= loadValidator().catch((error) => {
    validator = null;
    throw error;
  });
  return validator;
}

/** Valida el elemento <factura> contra el XSD v1.1.0 y devuelve los errores encontrados. */
export async function validateInvoiceSchema(xml: string): Promise<string[]> {
  const xsd = await getValidator();
  const doc = XmlDocument.fromString(xml);
  try {
    xsd.validate(doc);
    return [];
  } catch (error) {
    if (!(error instanceof XmlValidateError)) throw error;
    return error.details.slice(0, MAX_ERRORS).map((d) => d.message.trim());
  } finally {
    doc.dispose();
  }
}

/** Lanza un error legible si el XML no cumple el esquema del SRI. */
export async function assertInvoiceSchema(xml: string): Promise<void> {
  const errors = await validateInvoiceSchema(xml);
  if (errors.length) {
    throw new Error(`El XML no cumple el esquema del SRI (factura v1.1.0): ${errors.join(" | ")}`);
  }
}
