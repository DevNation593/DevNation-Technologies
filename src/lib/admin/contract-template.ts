import type { CompanySettings, ContractData, ContractKind } from "./types";

export const contractKinds: { value: ContractKind; label: string; title: string }[] = [
  { value: "software", label: "Desarrollo de software a medida", title: "CONTRATO DE DESARROLLO DE SOFTWARE" },
  { value: "saas", label: "Suscripción SaaS B2B", title: "CONTRATO DE SUSCRIPCIÓN A SERVICIOS SAAS" },
  { value: "support", label: "Soporte y mantenimiento TI", title: "CONTRATO DE SOPORTE Y MANTENIMIENTO TECNOLÓGICO" },
  { value: "consult", label: "Consultoría tecnológica", title: "CONTRATO DE CONSULTORÍA TECNOLÓGICA" },
  { value: "nda", label: "Acuerdo de confidencialidad (NDA)", title: "ACUERDO DE CONFIDENCIALIDAD" },
];

export const clauseOptions: { key: keyof ContractData["clauses"]; label: string }[] = [
  { key: "ip", label: "Propiedad intelectual y licencias" },
  { key: "privacy", label: "Protección de datos personales" },
  { key: "confidential", label: "Confidencialidad" },
  { key: "warranty", label: "Garantía y responsabilidades" },
  { key: "termination", label: "Terminación anticipada" },
  { key: "force", label: "Fuerza mayor" },
  { key: "disputes", label: "Solución de controversias" },
];

const ORDINALS = [
  "PRIMERA", "SEGUNDA", "TERCERA", "CUARTA", "QUINTA", "SEXTA", "SÉPTIMA", "OCTAVA", "NOVENA", "DÉCIMA",
  "DÉCIMA PRIMERA", "DÉCIMA SEGUNDA", "DÉCIMA TERCERA", "DÉCIMA CUARTA", "DÉCIMA QUINTA",
];

export function defaultContractData(settings: CompanySettings): ContractData {
  return {
    city: settings.ciudad || "Quito, Ecuador",
    provider: settings.razon_social,
    providerId: settings.ruc,
    providerRep: settings.representante_legal,
    providerAddress: settings.dir_matriz,
    providerEmail: settings.email,
    client: "",
    clientId: "",
    clientRep: "",
    clientAddress: "",
    clientEmail: "",
    project: "",
    scope: "",
    price: 0,
    months: 3,
    payment: "50% al inicio y 50% contra entrega y aceptación, previa emisión del comprobante correspondiente.",
    schedule: "El cronograma y los hitos se definirán en el Anexo A, suscrito por ambas partes.",
    sla: "Las incidencias reproducibles atribuibles al servicio contratado se atenderán según el alcance y horarios acordados en el Anexo A.",
    notice: 30,
    clauses: {
      ip: true,
      privacy: true,
      confidential: true,
      warranty: true,
      termination: true,
      force: true,
      disputes: true,
    },
    customTitle: "",
    customText: "",
  };
}

export interface ContractDocument {
  title: string;
  introduction: string;
  sections: { heading: string; body: string }[];
  closing: string;
  missing: string[];
}

function present(value: string | number | undefined, placeholder: string): string {
  const text = String(value ?? "").trim();
  return text || `[${placeholder}]`;
}

function longDate(iso: string): string {
  if (!iso) return "[fecha]";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" });
}

/** Texto del contrato a partir del tipo y los datos del formulario. */
export function buildContract(kind: ContractKind, data: ContractData, date: string): ContractDocument {
  const isNda = kind === "nda";
  const provider = present(data.provider, "razón social del prestador");
  const client = present(data.client, "nombre de la contraparte");
  const city = present(data.city, "ciudad");

  const introduction =
    `En ${city}, a ${longDate(date)}, comparecen, por una parte, ${provider}, identificación ${present(data.providerId, "RUC/identificación")}, ` +
    `representada por ${present(data.providerRep, "representante legal")}, con domicilio en ${present(data.providerAddress, "domicilio")}, ` +
    `en adelante “EL PRESTADOR”; y, por otra, ${client}, identificación ${present(data.clientId, "RUC/cédula")}, ` +
    `representada por ${present(data.clientRep, "representante legal")}, con domicilio en ${present(data.clientAddress, "domicilio")}, ` +
    `en adelante “EL CLIENTE”. Las partes, declarando contar con capacidad para contratar y obligarse, convienen las siguientes cláusulas:`;

  const subject: Record<ContractKind, string> = {
    software:
      "EL PRESTADOR realizará el análisis, diseño, desarrollo, pruebas y entrega del software descrito en el alcance y sus anexos. Las solicitudes fuera del alcance requerirán aprobación escrita de presupuesto y plazos.",
    saas:
      "EL PRESTADOR proporcionará acceso al servicio de software en la nube identificado en este contrato, conforme al plan de suscripción, número de usuarios, niveles de servicio, límites de uso y condiciones documentadas en el Anexo A.",
    support:
      "EL PRESTADOR ejecutará los servicios de soporte, mantenimiento preventivo y correctivo y asistencia técnica expresamente definidos en el alcance y el Anexo A.",
    consult:
      "EL PRESTADOR prestará asesoría y consultoría técnica y entregará los informes o recomendaciones definidos en el alcance y el Anexo A.",
    nda: "Las partes podrán intercambiar información confidencial con el propósito de evaluar, negociar o ejecutar la posible relación comercial identificada en este documento.",
  };

  const clauses: { title: string; body: string }[] = [
    { title: "Objeto", body: subject[kind] },
    {
      title: "Alcance y anexos",
      body:
        `Proyecto o servicio: ${present(data.project, "proyecto")}. Alcance acordado: ${present(data.scope, "detalle de alcance, entregables, exclusiones y criterios de aceptación")}. ` +
        "Los anexos escritos y aprobados por ambas partes forman parte integral del contrato. Si un anexo aún no se ha definido, las partes deberán completarlo antes de ejecutar obligaciones que dependan de él.",
    },
  ];

  if (!isNda) {
    clauses.push(
      {
        title: "Precio, impuestos y pagos",
        body:
          `El precio comercial referencial pactado es USD ${Number(data.price || 0).toFixed(2)}. Tratamiento de IVA, retenciones y demás tributos: se aplicarán conforme a la normativa vigente y al comprobante emitido; confirmar si el precio indicado incluye o excluye impuestos antes de firmar. ` +
          `Modalidad de pago: ${present(data.payment, "forma de pago")}. Los trabajos adicionales requerirán aprobación previa por escrito.`,
      },
      {
        title: "Plazo y ejecución",
        body: `Duración prevista: ${present(data.months, "número de")} mes(es), desde el inicio acordado por escrito. Cronograma y entregables: ${present(data.schedule, "cronograma")}. Las partes deberán comunicar oportunamente los impedimentos y aprobar por escrito los cambios de hitos.`,
      },
      {
        title: "Obligaciones y aceptación",
        body: "EL PRESTADOR ejecutará los servicios con diligencia profesional, informará incidencias relevantes y suministrará los entregables pactados. EL CLIENTE facilitará información, accesos y decisiones oportunas, revisará los entregables y documentará su aceptación u observaciones dentro del plazo que ambas partes establezcan en el Anexo A.",
      },
    );
  }

  if (data.clauses.ip) {
    clauses.push({
      title: "Propiedad intelectual y licencias",
      body:
        kind === "saas"
          ? "EL PRESTADOR o sus respectivos titulares conservarán la titularidad del software y sus componentes preexistentes. EL CLIENTE recibe exclusivamente una licencia de acceso no exclusiva, intransferible y limitada al plazo y alcance de la suscripción. Los datos proporcionados por EL CLIENTE seguirán bajo su titularidad o control según corresponda."
          : isNda
            ? "La divulgación de información no transfiere titularidad, licencia ni derecho de explotación de marcas, código fuente, documentos, know-how o demás activos intelectuales."
            : "Las herramientas, bibliotecas, metodologías, materiales y componentes preexistentes conservarán su titularidad. Los derechos sobre entregables desarrollados específicamente, el alcance de cualquier cesión o licencia, los usos permitidos y la entrega de código fuente deberán identificarse expresamente en el Anexo A; no se presume una transferencia general de derechos.",
    });
  }
  if (data.clauses.confidential) {
    clauses.push({
      title: "Confidencialidad",
      body: "Las partes protegerán la información técnica, comercial y financiera identificada como confidencial o que razonablemente deba considerarse confidencial, y la utilizarán solo para la finalidad contractual. Se exceptúa información pública, conocida lícitamente con anterioridad, recibida legítimamente de terceros o exigida legalmente. Se aplicarán medidas de seguridad razonables y las obligaciones subsistirán durante tres años desde la terminación, salvo información que por su naturaleza o por ley requiera mayor protección.",
    });
  }
  if (data.clauses.privacy) {
    clauses.push({
      title: "Protección de datos personales",
      body: "Cada parte cumplirá la normativa ecuatoriana aplicable en protección de datos personales. Las categorías de datos, finalidades, roles de responsable y encargado, instrucciones documentadas, controles de seguridad, subencargados, transferencias, notificación de incidentes y devolución o eliminación de datos deberán detallarse en un acuerdo de tratamiento de datos separado cuando resulte aplicable. Esta cláusula no sustituye dicho acuerdo.",
    });
  }
  if (!isNda && data.clauses.warranty) {
    clauses.push({
      title: "Garantías y responsabilidad",
      body: `Cobertura y SLA: ${present(data.sla, "condiciones de garantía y nivel de servicio")}. Las partes determinarán por escrito períodos de garantía, exclusiones, escalamiento, tiempos de respuesta y límites de responsabilidad compatibles con las disposiciones legales imperativas aplicables. Ninguna disposición excluye responsabilidades que por ley no puedan excluirse.`,
    });
  }
  if (data.clauses.termination) {
    clauses.push({
      title: "Terminación",
      body: `Cualquiera de las partes podrá comunicar por escrito el incumplimiento material de la otra parte y conceder un plazo razonable de subsanación a acordar en el Anexo A, salvo cuando legalmente no proceda. La terminación por conveniencia, cuando haya sido pactada, requerirá preaviso de ${present(data.notice, "días")} días. La liquidación de obligaciones, devoluciones, entregables y acceso a datos se documentará por escrito. Se respetarán las obligaciones que subsistan por su naturaleza.`,
    });
  }
  if (data.clauses.force) {
    clauses.push({
      title: "Fuerza mayor",
      body: "La parte afectada notificará sin demora razonable los eventos fuera de su control que impidan el cumplimiento y acreditará sus efectos. Las partes procurarán mitigar el impacto y acordar un reajuste razonable del cronograma, sin perjuicio de las disposiciones legales aplicables.",
    });
  }
  if (data.clauses.disputes) {
    clauses.push({
      title: "Ley aplicable y controversias",
      body: "El contrato se interpretará conforme al ordenamiento jurídico de la República del Ecuador. Ante discrepancias, las partes procurarán primero una negociación de buena fe. Cualquier mecanismo posterior de mediación, arbitraje o jurisdicción competente deberá pactarse expresamente y cumplir las formalidades legales aplicables.",
    });
  }
  if (data.customTitle.trim() || data.customText.trim()) {
    clauses.push({
      title: present(data.customTitle, "Cláusula adicional"),
      body: present(data.customText, "contenido de la cláusula"),
    });
  }

  const missingLabels: [keyof ContractData, string][] = [
    ["providerId", "RUC prestador"],
    ["providerRep", "representante prestador"],
    ["client", "cliente"],
    ["clientId", "identificación cliente"],
    ["clientRep", "representante cliente"],
  ];

  return {
    title: contractKinds.find((k) => k.value === kind)?.title ?? "CONTRATO",
    introduction,
    sections: clauses.map((c, i) => ({ heading: `${ORDINALS[i] ?? i + 1}. ${c.title}`, body: c.body })),
    closing: `En señal de conformidad, las partes suscriben el presente instrumento en ${city}, en la fecha indicada. Cualquier firma electrónica que se utilice deberá cumplir los requisitos legales aplicables.`,
    missing: missingLabels.filter(([key]) => !String(data[key] ?? "").trim()).map(([, label]) => label),
  };
}
