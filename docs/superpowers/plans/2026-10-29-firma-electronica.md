# Firma electrónica subida desde el panel — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir el `.p12` y su contraseña desde `/admin/configuracion` (cifrados en Postgres) y avisar de su caducidad
por correo (pg_cron + pg_net + Resend) y con un banner en todo el panel.

**Architecture:** Un módulo de cifrado AES-256-GCM (`crypto.ts`) y un parser puro de `.p12` (`p12.ts`) alimentan a
`certificate.ts`, que prioriza la firma de la tabla `public.sri_certificates` sobre las variables `SRI_P12_*`. Los
avisos por correo viven enteramente en Postgres (funciones en `private`, secretos en Vault) para no usar la clave
secreta en la app ni dar permisos a `anon`.

**Tech Stack:** Next.js 16 (server actions), TypeScript, Supabase Postgres (RLS, Vault, pg_cron, pg_net), node-forge,
`node:crypto`, Resend HTTP API.

**Spec:** `docs/superpowers/specs/2026-10-29-firma-electronica-design.md`

## Global Constraints

- Todo texto de interfaz, error, comentario y commit en **español**; commits Conventional Commits.
- Toda server action empieza con `adminClient()` y devuelve `ActionResult` (nunca lanza al cliente).
- Módulos con secretos importan `"server-only"`.
- Tablas nuevas: RLS + políticas con `private.is_admin()`; `revoke all ... from public, anon`; funciones con
  `set search_path = ''`; `security definer` solo en `public.send_certificate_test_email` (justificado en la spec).
- Sin `SUPABASE_SECRET_KEY` / service role en `src/`.
- Ningún `.p12`, clave ni contraseña real dentro del repo; los fixtures de prueba van en el scratchpad.
- Fechas de negocio en `America/Guayaquil`.
- Umbrales de aviso exactos: `{30, 15, 7, 1, 0}`; ventana de envío 08:00–20:00 Ecuador; cron `'0 * * * *'`,
  nombre `'aviso-caducidad-firma'`.
- Límites: `.p12`/`.pfx` ≤ 50 KB; contraseña ≤ 200 caracteres.
- No hay suite de pruebas: la verificación de cada tarea son scripts en el scratchpad ejecutados con
  `node --conditions=react-server <script>.ts` (Node 24 ejecuta TypeScript y esa condición hace que `server-only`
  no lance), más `npm run lint`, `npx tsc --noEmit` y `npm run build`.

## Review Focus

1. **Contraseña con espacios al inicio o final:** debe funcionar tal cual; **no** usar `text()` (recorta) para la
   contraseña. Prueba en la Tarea 2.
2. **Subject/issuer con `<`, `&` o comillas** en el HTML del correo: deben escaparse. Prueba en la Tarea 6.
3. **Vencimiento a medianoche (UTC vs Ecuador):** `daysLeft` y `days_left` deben usar la fecha de Ecuador; un
   certificado que vence el 2026-11-01 04:00 UTC vence el 2026-10-31 en Ecuador. Prueba en las Tareas 3 y 6.
4. **Firma subida con la `SRI_ENCRYPTION_KEY` A y servidor arrancado con la clave B:** debe dar un error claro, no
   un 500 ni datos basura. Prueba en la Tarea 1.
5. **Ningún admin con correo / faltan secretos en Vault:** la función debe lanzar un error explícito y no marcar
   el umbral como avisado. Prueba en la Tarea 6.

---

### Task 1: Cifrado AES-256-GCM

**Files:**
- Create: `src/lib/sri/crypto.ts`
- Test: `<scratchpad>/verify-crypto.ts`

**Interfaces:**
- Produces:
  - `encryptSecret(plain: Buffer, purpose: SecretPurpose): string` → `"v1:" + base64(iv(12) | tag(16) | ciphertext)`
  - `decryptSecret(value: string, purpose: SecretPurpose): Buffer`
  - `type SecretPurpose = "sri_certificates.p12" | "sri_certificates.password"` (va como AAD)
  - Errores (mensajes exactos):
    - Clave ausente o ≠ 32 bytes: `"Falta SRI_ENCRYPTION_KEY (32 bytes en base64) en las variables del servidor."`
    - Fallo al descifrar: `"No se pudo descifrar la firma electrónica. Verifica SRI_ENCRYPTION_KEY o vuelve a subir la firma."`

- [ ] **Step 1: Escribir `verify-crypto.ts`** que importe el módulo por ruta absoluta y compruebe con `node:assert`:
  - ida y vuelta: `decryptSecret(encryptSecret(buf, "sri_certificates.p12"), "sri_certificates.p12")` es igual a `buf`;
  - dos cifrados del mismo texto son distintos (IV aleatorio);
  - descifrar con el otro `purpose` lanza el mensaje de fallo;
  - descifrar tras cambiar `process.env.SRI_ENCRYPTION_KEY` a otra clave de 32 bytes lanza el mensaje de fallo
    (Review Focus 4);
  - con `SRI_ENCRYPTION_KEY` vacía, `encryptSecret` lanza el mensaje de clave ausente;
  - un valor sin prefijo `v1:` lanza el mensaje de fallo.
- [ ] **Step 2: Ejecutarlo** con `node --conditions=react-server verify-crypto.ts` → falla (el módulo no existe).
- [ ] **Step 3: Implementar `crypto.ts`** con `createCipheriv("aes-256-gcm", ...)`, `setAAD(Buffer.from(purpose))`.
  Lee la clave en cada llamada (no la cachea) para que el cambio de variable se note.
- [ ] **Step 4: Ejecutar el script** → todas las aserciones pasan.
- [ ] **Step 5: Commit** `feat: agrega el cifrado AES-256-GCM para la firma electrónica`

### Task 2: Parser puro de `.p12`

**Files:**
- Create: `src/lib/sri/p12.ts`
- Modify: `src/lib/sri/certificate.ts` (mover `SigningCertificate`, `bigIntegerToBase64`, `distinguishedName`,
  `readableName` y el cuerpo de parseo de `loadCertificate`, líneas ~5-106)
- Test: `<scratchpad>/make-test-p12.ts`, `<scratchpad>/verify-p12.ts`

**Interfaces:**
- Produces:
  - `export interface SigningCertificate` (mismos campos que hoy).
  - `parseP12(der: Buffer, password: string): SigningCertificate`. Errores exactos:
    - `"No se pudo abrir el archivo .p12. Verifica el archivo y la contraseña."`
    - `"El archivo .p12 no contiene una clave privada RSA con su certificado."` (el de hoy).
  - `certificate.ts` re-exporta `type SigningCertificate` para no romper `emit.ts` / `sign.ts`.

- [ ] **Step 1: Escribir `make-test-p12.ts`** (scratchpad) que con node-forge genere un par RSA 2048, un certificado
  autofirmado con CN `Prueba <Firma> & "Cía"` (Review Focus 2) y vigencia configurable, y escriba:
  - `valid.p12`: vence en 20 días, contraseña `"  clave con espacios "`;
  - `expired.p12`: venció ayer;
  - `not-p12.p12`: 100 bytes aleatorios.
- [ ] **Step 2: Escribir `verify-p12.ts`** que compruebe:
  - `parseP12(valid, "  clave con espacios ")` devuelve `subject` con el CN exacto y `validTo` en ~20 días
    (Review Focus 1);
  - `parseP12(valid, "clave con espacios")` (recortada) lanza el mensaje de apertura;
  - `parseP12(notP12, "x")` lanza el mensaje de apertura.
- [ ] **Step 3: Ejecutar** → falla (no existe `p12.ts`).
- [ ] **Step 4: Mover el parseo a `p12.ts`** (importa `"server-only"` y `node-forge`, nada de `@/`); `certificate.ts`
  lo usa en `loadCertificate`.
- [ ] **Step 5: Ejecutar** `verify-p12.ts` → pasa; `npx tsc --noEmit` → sin errores.
- [ ] **Step 6: Commit** `refactor: separa el parseo del .p12 en un módulo propio`

### Task 3: Migración de la tabla y lectura desde la base

**Files:**
- Create: `supabase/migrations/20261029120000_firma_electronica.sql` (parte 1: tabla)
- Modify: `src/lib/sri/certificate.ts`
- Modify: `src/lib/admin/types.ts` (tipo de la fila)

**Interfaces:**
- Consumes: `decryptSecret` (Task 1), `parseP12` (Task 2).
- Produces:
  - Tabla `public.sri_certificates` exactamente como en la spec §1, con RLS, `revoke all ... from public, anon`,
    `grant select, insert, update, delete ... to authenticated` y la política
    `"Administradores gestionan la firma electrónica"` `for all to authenticated` con `private.is_admin()`.
  - `getSigningCertificate(): Promise<SigningCertificate>` (misma firma que hoy).
  - `getCertificateStatus()` devuelve
    `{ configured: true; source: "panel" | "env"; subject; issuer; validFrom: string; validTo: string; daysLeft: number; expired: boolean; expiresSoon: boolean } | { configured: false; error: string }`
    donde `expiresSoon = daysLeft <= 30` y `expired = daysLeft < 0`.
  - `daysUntilInEcuador(iso: string): number` exportado desde `src/lib/admin/format.ts`: días entre `todayInEcuador()`
    y la fecha de `iso` en Ecuador (UTC-5).

- [ ] **Step 1: Escribir `verify-days.ts`** (scratchpad) con aserciones sobre `daysUntilInEcuador`, usando un
  `Date.now` fijo: hoy en Ecuador = 2026-10-29; `"2026-11-01T04:00:00Z"` → `2` (Review Focus 3);
  `"2026-10-29T23:00:00Z"` → `0`; `"2026-10-28T12:00:00Z"` → `-1`.
- [ ] **Step 2: Ejecutar** → falla; **implementar** `daysUntilInEcuador` → pasa.
- [ ] **Step 3: Escribir la parte 1 de la migración** (tabla, RLS, grants, política).
- [ ] **Step 4: Reescribir `getSigningCertificate`**: lee `uploaded_at` con `createClient()`; clave de caché
  `db:<uploaded_at>` o `env`; si cambia, descarta la promesa cacheada; con fila → selecciona las columnas cifradas,
  `decryptSecret` y `parseP12`; sin fila → ruta actual de variables. Un error de consulta a Supabase se trata como
  «sin fila» solo si es `PGRST116`/sin datos; cualquier otro se propaga.
- [ ] **Step 5: Ajustar `getCertificateStatus`** a la forma de arriba.
- [ ] **Step 6: Verificar** `npx tsc --noEmit` y `npm run lint` sin errores (los llamadores existentes compilan sin
  cambios porque los campos previos se conservan).
- [ ] **Step 7: Commit** `feat: lee la firma electrónica cifrada desde la base de datos`

### Task 4: Subir, quitar y probar la firma desde Configuración

**Files:**
- Modify: `src/app/admin/(panel)/configuracion/actions.ts`
- Create: `src/app/admin/(panel)/configuracion/CertificateForm.tsx`
- Modify: `src/app/admin/(panel)/configuracion/page.tsx:28-43`

**Interfaces:**
- Consumes: `encryptSecret` (Task 1), `parseP12` (Task 2), estado de Task 3, RPC `send_certificate_test_email`
  (Task 6; hasta entonces la acción devuelve el error de PostgREST, lo cual es aceptable).
- Produces (server actions):
  - `uploadCertificate(formData: FormData): Promise<ActionResult<{ subject: string; validTo: string }>>` —
    campos `p12` (File) y `password` (string).
  - `removeCertificate(): Promise<ActionResult<object>>`
  - `sendCertificateTestEmail(): Promise<ActionResult<object>>`

Mensajes exactos de `uploadCertificate`:
- Sin archivo: `"Selecciona el archivo .p12 de tu firma electrónica."`
- Extensión distinta de `.p12`/`.pfx` o > 50 KB: `"El archivo debe ser .p12 o .pfx de máximo 50 KB."`
- Contraseña vacía o > 200: `"Escribe la contraseña de la firma (máximo 200 caracteres)."`
- Caducado: `"La firma electrónica ya caducó el <formatDate(validTo)>. Sube una vigente."`
- Éxito en la UI: `"Firma cargada: <subject>, válida hasta <fecha>."`

- [ ] **Step 1: Implementar las tres acciones.** La contraseña se toma con
  `typeof v === "string" ? v : ""` (sin `trim`, Review Focus 1). `upsert` con `onConflict: "id"`, `id: 1`,
  `uploaded_by` = `requireAdmin().userId`, `uploaded_at: new Date().toISOString()`, `notified_days: []`,
  `pending_alert_request_id: null`, `pending_alert_day: null`. `revalidatePath("/admin", "layout")` tras subir o
  quitar.
- [ ] **Step 2: Implementar `CertificateForm.tsx`** siguiendo el patrón de `SettingsForm` (`useTransition`, mensaje
  con `notice success|danger`, `router.refresh()`); props `{ hasUploaded: boolean }`. Botones: «Subir firma»,
  «Quitar firma» (solo si `hasUploaded`, con `ConfirmDialog` tono `danger`) y «Enviar correo de prueba». Limpia el
  campo de contraseña tras cada intento.
- [ ] **Step 3: Actualizar la tarjeta en `page.tsx`**: titular, emisor, «Válida del X al Y», días restantes, origen
  («Subida en el panel» / «Variables de entorno») y `<CertificateForm hasUploaded={status.configured && status.source === "panel"} />`.
- [ ] **Step 4: Verificar** `npm run lint`, `npx tsc --noEmit`.
- [ ] **Step 5: Verificar en el navegador** (requiere la migración aplicada y `SRI_ENCRYPTION_KEY` en `.env.local`):
  con `npm run dev`, subir `valid.p12` con la contraseña con espacios → mensaje de éxito y tarjeta con origen
  «Subida en el panel»; subir `expired.p12` → mensaje de caducado; `not-p12.p12` → error de apertura; contraseña
  recortada → error de apertura; «Quitar firma» → vuelve a origen variables o a «sin firma». Si la migración no se
  puede aplicar, dejar constancia y limitarse al Step 4.
- [ ] **Step 6: Commit** `feat: permite subir y quitar la firma electrónica desde Configuración`

### Task 5: Banner de caducidad en todo el panel

**Files:**
- Modify: `src/app/admin/(panel)/layout.tsx:28-31`
- Modify: `src/app/admin/(panel)/page.tsx:70,88-92` (quitar `certExpiresSoon` y su banner)

**Interfaces:**
- Consumes: `getCertificateStatus()` (Task 3).

Textos exactos (con enlace «Configuración → Firma electrónica» a `/admin/configuracion`):
- `notice warning`, si `!expired && daysLeft <= 30`:
  `"La firma electrónica vence en N días (<fecha>)."` (`"vence hoy"` si `daysLeft === 0`, `"vence mañana"` si `1`).
- `notice danger`, si `expired`: `"La firma electrónica caducó el <fecha>. No puedes emitir facturas hasta subir una nueva."`

- [ ] **Step 1: Implementar el banner** dentro de `.adm-main`, después de `<MobileNav />`, envuelto en un
  `<div className="adm-content">` solo cuando haya aviso.
- [ ] **Step 2: Quitar el banner duplicado** del inicio (se conserva el de «Falta configurar la firma»).
- [ ] **Step 3: Verificar** lint + tsc; en el navegador, con `valid.p12` (20 días) el banner amarillo aparece en
  Inicio, Facturas y Clientes, y no aparece en Inicio dos veces.
- [ ] **Step 4: Commit** `feat: muestra el aviso de caducidad de la firma en todo el panel`

### Task 6: Avisos por correo en Postgres

**Files:**
- Modify: `supabase/migrations/20261029120000_firma_electronica.sql` (parte 2; la migración aún no se ha aplicado en
  producción)
- Test: `<scratchpad>/verify-alerts.sql`

**Interfaces:**
- Consumes: tabla de Task 3.
- Produces:
  - `private.escape_html(value text) returns text` (immutable; reemplaza `&`, `<`, `>`, `"` en ese orden).
  - `private.send_alert_email(subject text, html text) returns bigint`.
  - `private.notify_certificate_expiry() returns void`.
  - `public.send_certificate_test_email() returns void` (security definer).
  - Job `cron` `'aviso-caducidad-firma'`, `'0 * * * *'`.

Mensajes exactos de excepción:
- `'Falta el secreto % en Supabase Vault.'` (con `resend_api_key` o `alert_from_email`).
- `'No hay administradores con correo para enviar el aviso.'`
- `'No autorizado'` (en la función pública si `not private.is_admin()`).

Asuntos exactos:
- `days_left > 1`: `'La firma electrónica vence en ' || days_left || ' días'`
- `days_left = 1`: `'La firma electrónica vence mañana'`
- `days_left = 0`: `'La firma electrónica vence hoy'`
- `days_left < 0`: `'La firma electrónica caducó'`
- Prueba: `'Correo de prueba: aviso de firma electrónica'`

- [ ] **Step 1: Escribir `verify-alerts.sql`** (para ejecutar en una base local o de pruebas, dentro de una
  transacción con `rollback`):
  - `select private.escape_html('Prueba <Firma> & "Cía"')` = `'Prueba &lt;Firma&gt; &amp; &quot;Cía&quot;'`
    (Review Focus 2);
  - con `valid_to` en 10 días y `notified_days = '{}'`, `notify_certificate_expiry()` (con la ventana horaria
    satisfecha) deja `notified_days = '{15,30}'` y `pending_alert_day = 15`;
  - una segunda llamada inmediata no cambia `notified_days` (petición pendiente sin respuesta);
  - insertando en `net._http_response` una respuesta 500 para el id pendiente, la siguiente llamada quita `15` de
    `notified_days`;
  - sin filas en `admin_users`, `send_alert_email` lanza `'No hay administradores con correo para enviar el aviso.'`
    y `notified_days` no cambia (Review Focus 5);
  - `valid_to = '<mañana> 04:00:00+00'` con hoy en Ecuador antes de medianoche da `days_left = 0`
    (Review Focus 3; la función expone el cálculo en `private.certificate_days_left(valid_to timestamptz) returns int`
    para poder probarlo).
- [ ] **Step 2: Escribir la parte 2 de la migración**: `create extension if not exists pg_cron;`,
  `create extension if not exists pg_net;`, las funciones de arriba (todas `set search_path = ''`, nombres
  calificados: `vault.decrypted_secrets`, `net.http_post`, `net._http_response`, `auth.users`), los `revoke execute`
  de `public, anon, authenticated` en las funciones `private.*`, `grant execute` de la pública solo a
  `authenticated`, y `select cron.schedule(...)`. Lógica de `notify_certificate_expiry`: la de la spec §5, pasos 1-5.
  El HTML del correo incluye titular y emisor (escapados), fecha de vencimiento en formato `DD/MM/YYYY` y la URL
  `https://devnation.tech/admin/configuracion`.
- [ ] **Step 3: Ejecutar `verify-alerts.sql`** contra una base con la migración aplicada (`npx supabase start` +
  `npx supabase db reset` si Docker está disponible; si no, en el proyecto de pruebas del usuario con su
  autorización). Si no hay ninguna base disponible, dejarlo indicado en el informe final como no verificado.
- [ ] **Step 4: Commit** `feat: avisa por correo cuando la firma electrónica está por caducar`

### Task 7: Documentación y verificación final

**Files:**
- Modify: `.env.example`, `README.md` (sección de firma, ~líneas 50-60), `SECURITY.md` (Superficie de ataque y
  Controles existentes → Secretos)

- [ ] **Step 1: `.env.example`**: añadir bajo la firma
  `# Clave para cifrar la firma subida desde el panel (32 bytes en base64)` y `SRI_ENCRYPTION_KEY=`; marcar
  `SRI_P12_*` como «respaldo opcional si no se sube la firma en el panel».
- [ ] **Step 2: README**: sección «Firma electrónica y avisos» con los 5 pasos de la spec §7, incluido el comando
  para generar la clave.
- [ ] **Step 3: SECURITY.md**: documentar el cifrado con `SRI_ENCRYPTION_KEY`, los secretos en Vault, la tarea
  `pg_cron` y la función `security definer` con su comprobación de `private.is_admin()`.
- [ ] **Step 4: Verificación completa**: `npm run lint`, `npx tsc --noEmit`, `npm run build` sin errores;
  `git status` sin `.p12` ni `.env*` añadidos.
- [ ] **Step 5: Commit** `docs: documenta la subida de la firma y los avisos de caducidad`
