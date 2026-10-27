import "server-only";
import { XMLParser } from "fast-xml-parser";
import type { SriMessage } from "@/lib/admin/types";

const BASE_URLS = {
  1: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/",
  2: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/",
} as const;

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  // Evita convertir la clave y el número de autorización (49 dígitos) a number.
  parseTagValue: false,
  isArray: (name) => name === "mensaje" || name === "autorizacion",
});

type Node = Record<string, unknown>;

async function soapRequest(url: string, namespace: string, body: string): Promise<Node> {
  const envelope =
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="${namespace}">` +
    `<soapenv:Header/><soapenv:Body>${body}</soapenv:Body></soapenv:Envelope>`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml;charset=UTF-8", SOAPAction: "" },
      body: envelope,
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(`No se pudo conectar con el SRI: ${(error as Error).message}`);
  }

  const text = await response.text();
  const parsed = parser.parse(text) as Node;
  const responseBody = (parsed.Envelope as Node | undefined)?.Body as Node | undefined;
  if (!responseBody) {
    throw new Error(`Respuesta inesperada del SRI (HTTP ${response.status}).`);
  }
  const fault = responseBody.Fault as Node | undefined;
  if (fault) throw new Error(`El SRI devolvió un error: ${String(fault.faultstring ?? "desconocido")}`);
  return responseBody;
}

function readMessages(node: Node | undefined): SriMessage[] {
  const list = ((node?.mensajes as Node | undefined)?.mensaje as Node[] | undefined) ?? [];
  return list.map((m) => ({
    identificador: String(m.identificador ?? ""),
    mensaje: String(m.mensaje ?? ""),
    informacionAdicional: m.informacionAdicional ? String(m.informacionAdicional) : undefined,
    tipo: String(m.tipo ?? ""),
  }));
}

export interface ReceptionResult {
  status: "RECIBIDA" | "DEVUELTA";
  messages: SriMessage[];
}

export async function sendToReception(signedXml: string, environment: 1 | 2): Promise<ReceptionResult> {
  const body = await soapRequest(
    `${BASE_URLS[environment]}RecepcionComprobantesOffline`,
    "http://ec.gob.sri.ws.recepcion",
    `<ec:validarComprobante><xml>${Buffer.from(signedXml, "utf8").toString("base64")}</xml></ec:validarComprobante>`,
  );
  const result = (body.validarComprobanteResponse as Node | undefined)?.RespuestaRecepcionComprobante as
    | Node
    | undefined;
  if (!result) throw new Error("El SRI no devolvió el resultado de la recepción.");

  const comprobantes = (result.comprobantes as Node | undefined)?.comprobante;
  const first = (Array.isArray(comprobantes) ? comprobantes[0] : comprobantes) as Node | undefined;

  return {
    status: String(result.estado) === "RECIBIDA" ? "RECIBIDA" : "DEVUELTA",
    messages: readMessages(first),
  };
}

export interface AuthorizationResult {
  status: "AUTORIZADO" | "NO AUTORIZADO" | "EN PROCESO" | "SIN RESPUESTA";
  authorizationNumber?: string;
  authorizedAt?: string;
  environment?: string;
  comprobante?: string;
  messages: SriMessage[];
}

export async function queryAuthorization(accessKey: string, environment: 1 | 2): Promise<AuthorizationResult> {
  const body = await soapRequest(
    `${BASE_URLS[environment]}AutorizacionComprobantesOffline`,
    "http://ec.gob.sri.ws.autorizacion",
    `<ec:autorizacionComprobante><claveAccesoComprobante>${accessKey}</claveAccesoComprobante></ec:autorizacionComprobante>`,
  );
  const result = (body.autorizacionComprobanteResponse as Node | undefined)
    ?.RespuestaAutorizacionComprobante as Node | undefined;
  const authorizations = ((result?.autorizaciones as Node | undefined)?.autorizacion as Node[] | undefined) ?? [];

  if (!authorizations.length) return { status: "SIN RESPUESTA", messages: [] };

  // Si hay varios intentos, prevalece el autorizado.
  const chosen =
    authorizations.find((a) => String(a.estado) === "AUTORIZADO") ?? authorizations[authorizations.length - 1];
  const status = String(chosen.estado);

  return {
    status: status === "AUTORIZADO" || status === "NO AUTORIZADO" ? status : "EN PROCESO",
    authorizationNumber: chosen.numeroAutorizacion ? String(chosen.numeroAutorizacion) : undefined,
    authorizedAt: chosen.fechaAutorizacion ? String(chosen.fechaAutorizacion) : undefined,
    environment: chosen.ambiente ? String(chosen.ambiente) : undefined,
    comprobante: chosen.comprobante ? String(chosen.comprobante) : undefined,
    messages: readMessages(chosen),
  };
}

/** Documento de autorización con el formato que entrega el SRI. */
export function buildAuthorizedXml(result: AuthorizationResult): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<autorizacion>` +
    `<estado>${result.status}</estado>` +
    `<numeroAutorizacion>${result.authorizationNumber ?? ""}</numeroAutorizacion>` +
    `<fechaAutorizacion>${result.authorizedAt ?? ""}</fechaAutorizacion>` +
    `<ambiente>${result.environment ?? ""}</ambiente>` +
    `<comprobante><![CDATA[${(result.comprobante ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]></comprobante>` +
    `</autorizacion>`
  );
}
