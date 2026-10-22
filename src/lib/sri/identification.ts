import { FINAL_CONSUMER_ID, type IdentificationType } from "./catalogs";

function isValidCedula(value: string): boolean {
  if (!/^[0-9]{10}$/.test(value)) return false;
  const province = Number(value.slice(0, 2));
  if (!((province >= 1 && province <= 24) || province === 30)) return false;
  if (Number(value[2]) >= 6) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(value[i]) * (i % 2 === 0 ? 2 : 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(value[9]);
}

/**
 * Devuelve un mensaje de error o null si la identificación es válida para el
 * tipo indicado. Para RUC de sociedades solo se valida el formato, porque el
 * SRI ha emitido RUC que no cumplen el antiguo dígito verificador.
 */
export function validateIdentification(type: IdentificationType, value: string): string | null {
  const id = value.trim();
  switch (type) {
    case "05":
      return isValidCedula(id) ? null : "La cédula no es válida.";
    case "04":
      if (!/^[0-9]{13}$/.test(id)) return "El RUC debe tener 13 dígitos.";
      if (id.endsWith("000")) return "Los tres últimos dígitos del RUC no pueden ser 000.";
      if (Number(id[2]) < 6 && !isValidCedula(id.slice(0, 10))) {
        return "El RUC de persona natural no corresponde a una cédula válida.";
      }
      return null;
    case "07":
      return id === FINAL_CONSUMER_ID ? null : `Consumidor final usa ${FINAL_CONSUMER_ID}.`;
    default:
      return id.length >= 3 && id.length <= 20 ? null : "La identificación debe tener entre 3 y 20 caracteres.";
  }
}

/** Deduce el tipo SRI a partir del número (para clientes de cotizaciones y contratos). */
export function inferIdentificationType(value: string): IdentificationType {
  const id = value.trim();
  if (id === FINAL_CONSUMER_ID) return "07";
  if (/^[0-9]{13}$/.test(id)) return "04";
  if (/^[0-9]{10}$/.test(id)) return "05";
  return "06";
}
