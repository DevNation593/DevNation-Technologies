/** Dígito verificador módulo 11 con pesos 2..7 de derecha a izquierda. */
export function modulo11(digits: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight;
    weight = weight === 7 ? 2 : weight + 1;
  }
  const check = 11 - (sum % 11);
  if (check === 11) return 0;
  if (check === 10) return 1;
  return check;
}

export interface AccessKeyParts {
  /** Fecha de emisión en formato ISO (YYYY-MM-DD). */
  issueDate: string;
  docCode: string;
  ruc: string;
  environment: 1 | 2;
  estab: string;
  ptoEmi: string;
  secuencial: string;
  /** Código numérico de 8 dígitos elegido por el emisor. */
  numericCode: string;
  /** 1 = emisión normal. */
  emissionType?: "1";
}

/** Clave de acceso de 49 dígitos (ficha técnica, tabla 1). */
export function buildAccessKey(parts: AccessKeyParts): string {
  const [year, month, day] = parts.issueDate.split("-");
  const base =
    `${day}${month}${year}` +
    parts.docCode +
    parts.ruc +
    String(parts.environment) +
    parts.estab +
    parts.ptoEmi +
    parts.secuencial +
    parts.numericCode +
    (parts.emissionType ?? "1");

  if (!/^[0-9]{48}$/.test(base)) {
    throw new Error("Los datos para la clave de acceso no tienen el formato esperado.");
  }
  return base + modulo11(base);
}

export function isValidAccessKey(key: string): boolean {
  return /^[0-9]{49}$/.test(key) && modulo11(key.slice(0, 48)) === Number(key[48]);
}
