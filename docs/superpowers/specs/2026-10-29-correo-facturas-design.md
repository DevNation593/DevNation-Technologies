# Envío de facturas por correo (RIDE en PDF + XML)

- **Fecha:** 2026-10-29
- **Estado:** pendiente de revisión
- **Rama:** `feat/correo-facturas`, creada desde `main`. Es independiente del PR #7 (firma electrónica), pero ambos
  tocan `configuracion/page.tsx`, `README.md`, `.env.example` y `SECURITY.md`: quien se fusione segundo resuelve esos
  conflictos (son secciones distintas).

## Objetivo

Que cada factura **autorizada** llegue al correo del comprador con el **RIDE en PDF** y el **XML autorizado**, de forma
automática al autorizarse, con reenvío manual desde la factura y con la configuración del correo en el panel.

### Criterios de éxito

- Al quedar autorizada una factura cuyo comprador tiene correo, y con el envío automático activado, el comprador recibe
  un correo con `FACTURA-<estab>-<pto>-<secuencial>.pdf` y `.xml`, una sola vez.
- Desde la factura se puede reenviar a hasta 3 direcciones y descargar el PDF.
- Un fallo de correo nunca cambia el estado fiscal de la factura ni el resultado de la emisión.
- El PDF muestra los mismos datos y totales que el RIDE actual, calculados con la misma función.
- Se respetan las reglas de `AGENTS.md`: `adminClient()` en cada acción, sin clave secreta de Supabase en la app,
  `RESEND_API_KEY` solo en el servidor, sin debilitar `private.protect_authorized_invoice`.

### Fuera de alcance

- Envío de cotizaciones o contratos por correo.
- Plantillas de correo editables desde el panel.
- Seguimiento de aperturas o rebotes (webhooks de Resend).
- Cola de reintentos automáticos: si el envío automático falla, se reenvía a mano.
- SMTP propio (se decidió usar Resend).

## Decisiones tomadas

| Tema | Decisión | Motivo |
| --- | --- | --- |
| Adjuntos | PDF del RIDE + XML autorizado | Lo habitual en Ecuador; el cliente recibe un documento legible y el comprobante electrónico. |
| Momento | Automático al autorizarse + botón de reenvío | No depende de acordarse; el reenvío cubre fallos y destinatarios extra. |
| Configuración | Tarjeta «Correo de facturación» en Configuración | Cambiar el remitente no exige redesplegar. |
| Proveedor | Resend vía HTTP desde el servidor Next.js | Ya se eligió para los avisos de la firma; no añade SDK. |
| API key | Variable `RESEND_API_KEY` (servidor) | La app no puede leer Supabase Vault sin la clave secreta (P0). |
| PDF | `@react-pdf/renderer` (dependencia nueva, 4.x) | Genera PDF en Node sin navegador headless; compatible con React 19. |
| Código de barras | Barras calculadas con `jsbarcode` (ya instalado) y dibujadas como rectángulos | `JsBarcode({}, valor, { format: "CODE128" })` devuelve `encodings` sin DOM; evita otra dependencia. |

## Diseño

### 1. Esquema (migración nueva `supabase/migrations/<timestamp>_correo_facturas.sql`)

```sql
alter table public.company_settings
  add column invoice_email_enabled boolean not null default false,
  add column invoice_email_from text not null default '',
  add column invoice_email_reply_to text not null default '',
  add column invoice_email_bcc text not null default '';

alter table public.invoices
  add column last_emailed_at timestamptz,
  add column last_emailed_to text,
  add column last_email_error text;
```

- No hacen falta políticas nuevas: ambas tablas ya tienen RLS con `private.is_admin()` y `authenticated` ya tiene
  `update` sobre ellas.
- `private.protect_authorized_invoice` **no se modifica**: solo compara columnas fiscales, así que permite actualizar
  `last_email*` en facturas autorizadas.

### 2. Datos del RIDE compartidos (`src/lib/sri/ride.ts`, nuevo)

- `buildRideData(invoice: Invoice, settings: CompanySettings): RideData` con todo lo que hoy calcula y formatea
  `facturas/[id]/ride/page.tsx`: número, ambiente, emisión, autorización, comprador, líneas, subtotales por tarifa,
  descuentos, IVA, total, formas de pago e información adicional. Usa `computeInvoiceTotals` (sin duplicar cálculos).
- `ride/page.tsx` pasa a consumir `buildRideData`; su HTML visible no cambia.

### 3. PDF (`src/lib/sri/ride-pdf.tsx`, nuevo, `server-only`)

- `renderRidePdf(data: RideData, logoDataUrl: string): Promise<Buffer>` con `@react-pdf/renderer` (`renderToBuffer`).
- Formato A4, misma estructura del RIDE: cabecera con logo y datos del emisor; recuadro FACTURA con número,
  autorización, fecha de autorización, ambiente, emisión y clave de acceso con código de barras CODE128; comprador;
  tabla de detalle; información adicional y formas de pago; totales.
- Logo: solo `data:image/png` o `data:image/jpeg` (limitación de react-pdf). Con SVG/WEBP se omite el logo y se
  muestra el nombre comercial; la tarjeta de configuración lo advierte.
- Código de barras: `barcodeBars(value: string): { x: number; width: number }[]` a partir de `encodings[].data`
  (`"1"` = barra), dibujado con `<Svg><Rect/></Svg>`.
- Fuente: Helvetica (incluida en PDF); los acentos y la «ñ» se verifican en la prueba.

### 4. Envío (`src/lib/sri/invoice-email.ts`, nuevo, `server-only`)

- `parseRecipients(value: string, max = 3): string[]` — separa por coma o punto y coma, recorta, valida cada una con
  `/^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/` y longitud ≤ 254, sin duplicados (sin distinguir mayúsculas).
  Errores exactos: `"Escribe al menos un correo válido."`, `"Máximo 3 destinatarios."`,
  `"Correo no válido: <valor>"`.
- `buildInvoiceEmail(input): { subject; html; attachments }` (pura, sin red):
  - Asunto: `Factura <001-001-000000123> de <nombre comercial o razón social>`.
  - HTML con saludo al comprador, número, fecha de emisión, total, clave de acceso y datos de contacto del emisor;
    **todos los valores escapados**.
  - Adjuntos: `{ filename: "FACTURA-001-001-000000123.pdf", content: <base64> }` y el `.xml` con
    `invoice.authorized_xml` tal cual.
- `sendInvoiceEmail(supabase, invoiceId, options: { to?: string[]; trigger: "auto" | "manual" }): Promise<{ to: string[] }>`
  1. Lee la factura y `company_settings`. Exige `status = 'autorizada'` y `authorized_xml`; si no,
     `"Solo se pueden enviar facturas autorizadas."`.
  2. Exige `RESEND_API_KEY` y `invoice_email_from`; si no, `"Configura el correo de facturación en Configuración."`.
  3. Destinatarios: `options.to` o `parseRecipients(buyer.email)`.
  4. `POST https://api.resend.com/emails` con `from`, `to`, `bcc` (si hay), `reply_to` (si hay), `subject`, `html`,
     `attachments`; cabecera `Idempotency-Key: factura-<id>-auto` solo en `trigger = "auto"`; `AbortSignal.timeout(15000)`.
  5. Éxito → `last_emailed_at = now()`, `last_emailed_to = to.join(", ")`, `last_email_error = null`.
     Error → `last_email_error` con un mensaje legible (`message` de Resend recortado a 300 caracteres, o
     `"No se pudo conectar con el servicio de correo."`), nunca la API key; y lanza ese mismo mensaje.
- `maybeSendOnAuthorization(supabase, invoiceId): Promise<EmailOutcome | null>` — envía solo si
  `invoice_email_enabled`, hay `RESEND_API_KEY`, el comprador tiene un correo válido y `last_emailed_at` es nulo.
  Nunca lanza: devuelve `{ sent: true, to } | { sent: false, error }` o `null` si no correspondía enviar.

### 5. Acciones y rutas

- `facturas/actions.ts`:
  - `emitInvoice` y `checkAuthorization`: si el resultado es `autorizada`, llaman a `maybeSendOnAuthorization` y
    añaden `email?: EmailOutcome` al resultado. Un error de correo no cambia `ok` ni el estado.
  - `resendInvoiceEmail(id: string, recipients: string): Promise<ActionResult<{ to: string[] }>>` →
    `adminClient()`, `parseRecipients`, `sendInvoiceEmail(..., { trigger: "manual" })`, `revalidatePath`.
- `facturas/[id]/pdf/route.ts` (nuevo): `requireAdmin()`, solo facturas autorizadas (404 si no), devuelve el PDF con
  `Content-Type: application/pdf`, `Content-Disposition: inline; filename="FACTURA-….pdf"` y
  `Cache-Control: private, no-store`, igual que la ruta del XML.
- `configuracion/actions.ts`: `saveInvoiceEmailSettings(input)` → `adminClient()`, valida `from` (correo o
  `Nombre <correo>`), `reply_to` y `bcc` con `parseRecipients(…, 1)` si no están vacíos, longitud ≤ 200.

### 6. Interfaz

- **Configuración → «Correo de facturación»** (`InvoiceEmailForm.tsx`, cliente): interruptor «Enviar automáticamente
  al autorizar», remitente, responder a, copia oculta; indicador «API key de Resend: configurada / falta
  `RESEND_API_KEY`» (calculado en el servidor, sin exponer el valor); aviso si el logo no es PNG/JPG.
- **Factura autorizada** (`InvoiceEditor.tsx` / página de la factura):
  - Línea de estado: «Enviada por correo a X el dd/mm/aaaa hh:mm», o `last_email_error` en `notice danger`.
  - Botón «Reenviar por correo» → `ConfirmDialog` con un campo de destinatarios precargado con `buyer.email`.
  - Enlace «Descargar PDF» junto a los del RIDE y XML.
  - Tras emitir/consultar, el mensaje de resultado añade «Factura enviada por correo a …» o «No se pudo enviar el
    correo: …».

### 7. Documentación y configuración

- `.env.example`: `RESEND_API_KEY=` con comentario «solo servidor».
- `README.md`: sección «Envío de facturas por correo»: verificar el dominio en Resend, `RESEND_API_KEY` en Vercel,
  configurar remitente en el panel, activar el envío automático, probar con «Reenviar por correo».
- `SECURITY.md`: `RESEND_API_KEY` en la lista de secretos; validación de destinatarios; la ruta del PDF exige admin.

## Manejo de errores

| Situación | Resultado |
| --- | --- |
| Falta `RESEND_API_KEY` o remitente | Automático: no se envía (`null`), la UI de Configuración lo indica. Manual: error claro. |
| Comprador sin correo o con correo inválido | Automático: no se envía. Manual: el diálogo exige un destinatario válido. |
| Resend responde 4xx/5xx | Se guarda y muestra el mensaje de Resend (p. ej. dominio no verificado); la factura sigue autorizada. |
| Tiempo de espera o red | `"No se pudo conectar con el servicio de correo."` |
| Dos pestañas autorizan a la vez | La `Idempotency-Key` de Resend evita el correo duplicado (24 h). |
| Logo SVG/WEBP | El PDF sale sin logo, con el nombre comercial. |
| Factura no autorizada | Ni envío ni PDF (404 en la ruta). |

## Verificación

No hay suite de pruebas; se valida con:

1. `npm run lint`, `npx tsc --noEmit`, `npm run build`.
2. Scripts en el scratchpad (`node --conditions=react-server`):
   - `parseRecipients`: válidos, inválidos, duplicados, más de 3, intento de inyección con salto de línea.
   - `buildInvoiceEmail`: escape de `<`, `&`, comillas en comprador y emisor; nombres de adjuntos; XML intacto.
   - `sendInvoiceEmail` con `fetch` simulado: 200, 422 con mensaje, error de red; `Idempotency-Key` solo en auto.
   - `renderRidePdf` con una factura de prueba: empieza por `%PDF`, contiene los textos clave con acentos; se abre en
     el navegador para compararlo visualmente con el RIDE.
3. En el navegador contra Supabase local: guardar la configuración, reenviar (con `fetch` a Resend fallando por falta
   de key → error mostrado), descargar el PDF.
4. **No cubierto:** la entrega real, salvo que el usuario aporte una API key de pruebas (envío solo a
   `delivered@resend.dev`).
