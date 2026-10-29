# Envío de facturas por correo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar cada factura autorizada al comprador con el RIDE en PDF y el XML autorizado (automático al autorizar,
reenvío manual), con la configuración del correo en el panel.

**Architecture:** `ride.ts` calcula los datos del RIDE una sola vez para la página HTML y el PDF (`ride-pdf.tsx`,
`@react-pdf/renderer`). `invoice-email.ts` arma el correo (funciones puras probables) y lo envía por la API HTTP de
Resend con `RESEND_API_KEY`; las acciones de facturas lo llaman al autorizar y desde un botón de reenvío.

**Tech Stack:** Next.js 16 (server actions, route handlers), TypeScript, Supabase Postgres, `@react-pdf/renderer` 4.x,
`jsbarcode`, Resend HTTP API.

**Spec:** `docs/superpowers/specs/2026-10-29-correo-facturas-design.md`

## Global Constraints

- Texto de interfaz, errores, comentarios y commits en **español**; Conventional Commits.
- Toda server action empieza con `adminClient()` y devuelve `ActionResult`; las rutas nuevas bajo `/admin` llaman a
  `requireAdmin()`.
- Módulos con secretos o I/O de servidor importan `"server-only"`; `RESEND_API_KEY` nunca en `NEXT_PUBLIC_*`, logs ni
  mensajes al usuario.
- No modificar `private.protect_authorized_invoice` ni ninguna migración ya aplicada.
- Importes con la lógica de `src/lib/sri/totals.ts` (`computeInvoiceTotals`); no duplicar cálculos.
- Máximo 3 destinatarios; asunto `Factura <número> de <nombre comercial o razón social>`; adjuntos
  `FACTURA-<estab>-<pto>-<secuencial>.pdf` / `.xml`; `Idempotency-Key: factura-<id>-auto` solo en envío automático;
  timeout 15 s; `last_email_error` ≤ 300 caracteres.
- Dependencia nueva única: `@react-pdf/renderer@4.9.0` (versión fijada, sin `^`, como las críticas del proyecto).
- Verificación por scripts en el scratchpad con `npx --yes tsx@4.23.15 --conditions=react-server <script>.ts` (resuelve
  `@/` y JSX vía `tsconfig.json`; la condición hace que `server-only` no lance), más `npm run lint`,
  `npx tsc --noEmit`, `npm run build`. Los fixtures van en el scratchpad, nunca en el repo.

## Review Focus

1. **`buyer.email` con varias direcciones o con espacios** (`"a@x.com, b@y.com"`, `" a@x.com "`): el envío automático
   debe usarlas todas (máx. 3); un correo inválido no debe lanzar, solo omitir el envío. Prueba en la Tarea 4.
2. **Resend responde algo que no es JSON** (502 con HTML) o la red falla: mensaje legible, sin excepción no capturada
   y sin la API key. Prueba en la Tarea 4.
3. **Acentos, «ñ» y textos largos en el PDF** (descripción de 300 caracteres, 40 líneas): el PDF pagina y muestra
   «Dirección», «Peña» correctamente. Prueba en la Tarea 3.
4. **Consumidor final sin correo** autorizado con envío automático activado: no envía y la emisión dice solo
   «AUTORIZADA», sin error. Prueba en la Tarea 4 (`autoSendRecipients`).
5. **Inyección en destinatarios** (`"a@x.com\nBcc: z@evil.com"`, `"<a@x.com>"`): rechazada. Prueba en la Tarea 4.

---

### Task 1: Migración y tipos

**Files:**
- Create: `supabase/migrations/20261029180000_correo_facturas.sql`
- Modify: `src/lib/admin/types.ts` (`CompanySettings`, `Invoice`)
- Test: `<scratchpad>/verify-email-columns.sql`

**Interfaces:**
- Produces: columnas de la spec §1 exactamente; en TS:
  - `CompanySettings` + `invoice_email_enabled: boolean; invoice_email_from: string; invoice_email_reply_to: string; invoice_email_bcc: string;`
  - `Invoice` + `last_emailed_at: string | null; last_emailed_to: string | null; last_email_error: string | null;`

- [ ] **Step 1: Escribir `verify-email-columns.sql`** (transacción con `rollback`): inserta una factura `autorizada`
  con `access_key`, la actualiza con `last_emailed_at = now(), last_emailed_to = 'a@x.com', last_email_error = null`
  sin error, y comprueba que actualizar `total` en esa misma factura sigue lanzando
  `'La factura % ya fue autorizada y no puede modificarse.'`; comprueba los defaults de `company_settings`
  (`invoice_email_enabled = false`, textos `''`).
- [ ] **Step 2: Ejecutarlo** contra Supabase local (`docker exec -i supabase_db_DevNation593 psql -U postgres -q`) →
  falla (columnas inexistentes). Si Docker no está disponible, detenerse y pedir al usuario que abra Docker Desktop.
- [ ] **Step 3: Escribir la migración** y aplicarla con `npx supabase migration up --local` (nunca `db reset`).
- [ ] **Step 4: Ejecutar el SQL** → `verify-email-columns: OK`; actualizar los tipos; `npx tsc --noEmit` sin errores.
- [ ] **Step 5: Commit** `feat: agrega la configuración y el registro del correo de facturas`

### Task 2: Datos del RIDE compartidos

**Files:**
- Create: `src/lib/sri/ride.ts`
- Modify: `src/app/admin/(panel)/facturas/[id]/ride/page.tsx:32-255`
- Test: `<scratchpad>/fixture-invoice.ts`, `<scratchpad>/verify-ride.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface RideRow { label: string; value: string; strong?: boolean }
  export interface RideData {
    number: string;                 // "001-001-000000123"
    fileBase: string;               // "FACTURA-001-001-000000123"
    authorized: boolean;
    issuer: { ruc: string; razonSocial: string; nombreComercial: string; rows: RideRow[] }; // rows = Dirección matriz…, régimen
    authorizationNumber: string;
    authorizedAt: string;           // formatDateTime o "PENDIENTE"
    environment: string;            // "PRUEBAS" | "PRODUCCIÓN"
    accessKey: string;
    buyer: { name: string; idLabel: string; identification: string; address: string; email: string };
    issueDate: string;              // formatDate
    lines: { code: string; quantity: string; description: string; unitPrice: string; discount: string; total: string }[];
    additionalInfo: { name: string; value: string }[];
    payments: { label: string; amount: string; term: string }[];
    totals: RideRow[];              // último: { label: "VALOR TOTAL", value: formatMoney(total), strong: true }
    total: number;
  }
  export function buildRideData(invoice: Invoice, settings: CompanySettings): RideData
  ```
  `nombreComercial` es `""` si coincide con la razón social. Los textos son exactamente los que hoy pinta el RIDE.

- [ ] **Step 1: Escribir `fixture-invoice.ts`** (exporta `invoice: Invoice` autorizada con 2 líneas —IVA 15 % y 0 %—,
  un descuento, comprador «José Peña <Pruebas> & Cía», `buyer.email = " a@x.com, b@y.com "`, dos campos adicionales,
  un pago con plazo; y `settings: CompanySettings` con logo PNG pequeño) y **`verify-ride.ts`** con aserciones:
  `number === "001-001-000000123"`, `fileBase === "FACTURA-001-001-000000123"`, `environment === "PRUEBAS"`, la fila
  `SUBTOTAL IVA 15%` y `VALOR TOTAL` con los valores que da `computeInvoiceTotals` para el fixture, `lines[0].quantity`
  con 6 decimales, `payments[0].term === "30 dias"` (o el texto actual del RIDE), `additionalInfo.length === 2`.
- [ ] **Step 2: Ejecutar** → falla (no existe `ride.ts`).
- [ ] **Step 3: Implementar `buildRideData`** moviendo la lógica de `ride/page.tsx`; la página pasa a renderizar desde
  `RideData` sin cambiar su HTML visible.
- [ ] **Step 4: Ejecutar** `verify-ride.ts` → OK; `npx tsc --noEmit` y `npm run lint` sin errores; abrir
  `/admin/facturas/<id>/ride` de una factura local y comparar con una captura previa al cambio (mismo contenido).
- [ ] **Step 5: Commit** `refactor: extrae los datos del RIDE a un módulo compartido`

### Task 3: PDF del RIDE y ruta de descarga

**Files:**
- Modify: `package.json`, `package-lock.json` (`@react-pdf/renderer@4.9.0`)
- Create: `src/lib/sri/ride-pdf.tsx`, `src/app/admin/(panel)/facturas/[id]/pdf/route.ts`
- Modify: `next.config.ts` solo si el build exige `serverExternalPackages: ["@react-pdf/renderer"]`
- Test: `<scratchpad>/verify-pdf.ts`

**Interfaces:**
- Consumes: `RideData`, `buildRideData` (Task 2).
- Produces:
  - `barcodeBars(value: string): { x: number; width: number }[]` — de `JsBarcode({}, value, { format: "CODE128" }).encodings`,
    cada racha de `"1"` es una barra (`x` y `width` en módulos).
  - `renderRidePdf(data: RideData, logoDataUrl: string): Promise<Buffer>` (A4, Helvetica; logo solo si empieza por
    `data:image/png` o `data:image/jpeg`, si no, `nombreComercial || razonSocial` en texto).
  - Ruta `GET /admin/facturas/[id]/pdf`: `requireAdmin()`; 404 `"No encontrado"` si la factura no es `autorizada` o
    `anulada` con `access_key`; cabeceras `Content-Type: application/pdf`,
    `Content-Disposition: inline; filename="<fileBase>.pdf"`, `Cache-Control: private, no-store`.

- [ ] **Step 1: Escribir `verify-pdf.ts`**: `barcodeBars("123")` devuelve barras con `width ≥ 1` y la suma de
  módulos igual a la longitud de `encodings` concatenadas contando solo `"1"`; `renderRidePdf` con el fixture empieza
  por `%PDF-`; con un fixture de 40 líneas y una descripción de 300 caracteres, el número de `/Type /Page` (sin
  contar `/Pages`) es ≥ 2 (Review Focus 3); con logo `data:image/svg+xml;…` no lanza. Escribe los PDF en el scratchpad.
- [ ] **Step 2: Ejecutar** → falla (no existe el módulo).
- [ ] **Step 3: Instalar** `npm install --save-exact @react-pdf/renderer@4.9.0` e **implementar** `ride-pdf.tsx`
  reproduciendo la estructura de la spec §3 y la ruta.
- [ ] **Step 4: Ejecutar** `verify-pdf.ts` → OK. Abrir el PDF del fixture en el navegador del panel y revisar
  visualmente: acentos y «ñ» de «José Peña <Pruebas> & Cía», código de barras, totales alineados (Review Focus 3).
- [ ] **Step 5: Verificar** `npx tsc --noEmit`, `npm run lint`, `npm run build` (si falla por empaquetado, añadir
  `serverExternalPackages` y dejar `Ruling:`).
- [ ] **Step 6: Commit** `feat: genera el RIDE en PDF y permite descargarlo`

### Task 4: Armado y envío del correo

**Files:**
- Create: `src/lib/sri/invoice-email.ts`
- Test: `<scratchpad>/verify-invoice-email.ts`

**Interfaces:**
- Consumes: `buildRideData`, `renderRidePdf` (Tasks 2-3); tipos de Task 1.
- Produces:
  - `parseRecipients(value: string, max = 3): string[]` — errores exactos de la spec §4.
  - `autoSendRecipients(invoice: Invoice, settings: CompanySettings, hasApiKey: boolean): string[] | null` — `null`
    si no corresponde (desactivado, sin key, sin remitente, ya enviada, correo vacío o inválido); nunca lanza.
  - `buildInvoiceEmail(input: { data: RideData; settings: CompanySettings; pdf: Buffer; authorizedXml: string }): { subject: string; html: string; attachments: { filename: string; content: string }[] }`
  - `postToResend(payload: ResendPayload, options: { apiKey: string; idempotencyKey?: string }): Promise<{ id: string }>`
    — lanza `Error` con el `message` de Resend (≤ 300) o `"No se pudo conectar con el servicio de correo."`.
  - `sendInvoiceEmail(supabase: SupabaseClient, invoiceId: string, options: { to?: string[]; trigger: "auto" | "manual" }): Promise<{ to: string[] }>`
  - `type EmailOutcome = { sent: true; to: string[] } | { sent: false; error: string }`
  - `maybeSendOnAuthorization(supabase: SupabaseClient, invoiceId: string): Promise<EmailOutcome | null>` — nunca lanza.

- [ ] **Step 1: Escribir `verify-invoice-email.ts`** con aserciones:
  - `parseRecipients(" a@x.com, b@y.com ")` → `["a@x.com", "b@y.com"]`; `"a@x.com;A@X.com"` → `["a@x.com"]`;
    4 correos → `"Máximo 3 destinatarios."`; `""` → `"Escribe al menos un correo válido."`;
    `"a@x.com\nBcc: z@evil.com"` y `"<a@x.com>"` → `"Correo no válido: …"` (Review Focus 5).
  - `autoSendRecipients`: con el fixture y envío activado + key → los 2 correos (Review Focus 1); desactivado → `null`;
    sin key → `null`; `last_emailed_at` con valor → `null`; consumidor final con `email: ""` → `null`; email
    `"no-es-correo"` → `null` sin lanzar (Review Focus 4).
  - `buildInvoiceEmail`: asunto exacto `Factura 001-001-000000123 de <nombre>`; el HTML contiene
    `José Peña &lt;Pruebas&gt; &amp; Cía` y no `<Pruebas>`; adjuntos `FACTURA-001-001-000000123.pdf` y `.xml`, con el
    XML decodificado idéntico a `authorized_xml`.
  - `postToResend` con `globalThis.fetch` sustituido: 200 `{ id: "re_1" }` → `{ id: "re_1" }` y cabeceras
    `Authorization: Bearer test` e `Idempotency-Key` solo cuando se pasa; 422 `{ message: "The domain is not verified" }`
    → lanza ese mensaje; 502 con cuerpo HTML → lanza `"El servicio de correo respondió con un error (502)."`;
    `fetch` que rechaza → `"No se pudo conectar con el servicio de correo."`; ningún mensaje contiene `"test"` de la
    key (Review Focus 2).
- [ ] **Step 2: Ejecutar** → falla (no existe el módulo).
- [ ] **Step 3: Implementar** el módulo. `sendInvoiceEmail`: pasos 1-5 de la spec §4 (lee con `select("*")`,
  `getCompanySettings`, `buildRideData`, `renderRidePdf`, `buildInvoiceEmail`, `postToResend`; guarda `last_email*`
  en éxito o error y relanza el mensaje). `maybeSendOnAuthorization` relee la factura, usa `autoSendRecipients` y
  atrapa todo error en `{ sent: false, error }`.
- [ ] **Step 4: Ejecutar** el script → OK; `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 5: Commit** `feat: arma y envía el correo de la factura con Resend`

### Task 5: Envío automático, reenvío y pantalla de la factura

**Files:**
- Modify: `src/app/admin/(panel)/facturas/actions.ts:94-115`
- Modify: `src/app/admin/(panel)/facturas/InvoiceEditor.tsx` (mensajes ~170-185, enlaces ~215-220)
- Modify: `src/app/admin/(panel)/facturas/[id]/page.tsx` (pasar `last_email*` y `buyer.email` si no llegan ya en `invoice`)

**Interfaces:**
- Consumes: `maybeSendOnAuthorization`, `sendInvoiceEmail`, `parseRecipients`, `EmailOutcome` (Task 4).
- Produces:
  - `emitInvoice` / `checkAuthorization` → `ActionResult<EmissionOutcome & { email?: EmailOutcome }>`.
  - `resendInvoiceEmail(id: string, recipients: string): Promise<ActionResult<{ to: string[] }>>`.

Textos exactos:
- Tras autorizar: `"Factura AUTORIZADA por el SRI."` + `" Enviada por correo a a@x.com, b@y.com."` o
  `" No se pudo enviar el correo: <error>."` (tono `warning` en ese caso).
- Estado: `"Enviada por correo a <to> el <formatDateTime>"` (hint) o `last_email_error` en `notice danger`.
- Botón `"Reenviar por correo"`; diálogo `ConfirmDialog` título `"Enviar factura por correo"`, campo
  `"Destinatarios (máximo 3, separados por coma)"`, confirmar `"Enviar"`; éxito `"Factura enviada a <to>."`.
- Enlace `"Descargar PDF"` → `/admin/facturas/<id>/pdf` junto a RIDE y XML, solo si está autorizada o anulada.

- [ ] **Step 1: Implementar las acciones** (el correo se intenta solo si `outcome.status === "autorizada"`; un
  error de correo no cambia `ok`).
- [ ] **Step 2: Implementar la UI** con los textos exactos; «Reenviar por correo» solo en `autorizada`.
- [ ] **Step 3: Verificar** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 4: Verificar en el navegador** contra Supabase local con una factura autorizada sembrada por SQL (con
  `authorized_xml` de prueba) y `RESEND_API_KEY=re_prueba_invalida` en una `.env.development.local` temporal:
  «Descargar PDF» abre el PDF; «Reenviar por correo» con un destinatario válido muestra el error de Resend (key
  inválida) y lo deja en `last_email_error`; con `"a@x.com\nb"` muestra `"Correo no válido: …"`. Borrar la
  `.env.development.local` al terminar.
- [ ] **Step 5: Commit** `feat: envía la factura por correo al autorizarla y permite reenviarla`

### Task 6: Configuración del correo de facturación

**Files:**
- Modify: `src/app/admin/(panel)/configuracion/actions.ts`
- Create: `src/app/admin/(panel)/configuracion/InvoiceEmailForm.tsx`
- Modify: `src/app/admin/(panel)/configuracion/page.tsx`

**Interfaces:**
- Consumes: `parseRecipients` (Task 4), columnas de Task 1.
- Produces: `saveInvoiceEmailSettings(input: { enabled: boolean; from: string; replyTo: string; bcc: string }): Promise<ActionResult<object>>`.

Reglas y textos exactos:
- `from` vacío solo si `enabled` es `false`; si no, debe ser `correo` o `Nombre <correo>` (nombre sin `<>"\n`, ≤ 200):
  `"Escribe el remitente, p. ej. DevNation Facturación <facturacion@devnation.tech>."`.
- `replyTo` y `bcc`: vacíos o `parseRecipients(valor, 1)`.
- Tarjeta `"Correo de facturación"`: interruptor `"Enviar automáticamente cada factura autorizada al comprador"`,
  campos `"Remitente"`, `"Responder a"`, `"Copia oculta (tu archivo)"`; indicador
  `"API key de Resend: configurada"` / `"Falta RESEND_API_KEY en las variables del servidor."` (calculado en
  `page.tsx` con `Boolean(process.env.RESEND_API_KEY)`); aviso si `logo_data_url` no es PNG/JPG:
  `"El logo no es PNG ni JPG: el PDF de las facturas saldrá sin logo."`.

- [ ] **Step 1: Implementar** la acción, el formulario (patrón de `SettingsForm`: `useTransition`, `notice`,
  `router.refresh()`) y la tarjeta.
- [ ] **Step 2: Verificar** `npx tsc --noEmit`, `npm run lint`; en el navegador local: activar sin remitente → error
  exacto; guardar `DevNation Facturación <facturacion@devnation.tech>` → éxito y persiste tras recargar; `bcc`
  inválido → `"Correo no válido: …"`; el indicador refleja la key.
- [ ] **Step 3: Commit** `feat: agrega la configuración del correo de facturación`

### Task 7: Documentación y verificación final

**Files:**
- Modify: `.env.example`, `README.md` (sección de facturación), `SECURITY.md` (Controles → Secretos, lista de
  verificación de facturación)

- [ ] **Step 1:** `.env.example`: `# Envío de facturas por correo (solo servidor)` y `RESEND_API_KEY=`.
- [ ] **Step 2:** README: sección «Envío de facturas por correo» con los 5 pasos de la spec §7.
- [ ] **Step 3:** SECURITY.md: `RESEND_API_KEY` como secreto de servidor; validación de destinatarios (máx. 3, sin
  saltos de línea); la ruta del PDF exige admin y no se cachea; casilla nueva en la lista de verificación.
- [ ] **Step 4: Verificación completa**: `npm run lint`, `npx tsc --noEmit`, `npm run build`; volver a ejecutar los
  scripts de las Tareas 2-4; `git status` sin `.env*`, PDF ni fixtures añadidos.
- [ ] **Step 5: Commit** `docs: documenta el envío de facturas por correo`
