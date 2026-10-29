# Firma electrónica subida desde el panel y avisos de caducidad

- **Fecha:** 2026-10-29
- **Estado:** pendiente de revisión
- **Rama:** `feat/firma-electronica-panel`, creada desde `feat/portafolio-hcx-care` (el panel administrativo aún no
  está en `main`)

## Objetivo

1. Que el administrador **suba el certificado `.p12` y su contraseña desde el panel** (`/admin/configuracion`) en lugar
   de configurarlos en variables de entorno.
2. Que el sistema **avise por correo y en el panel** antes de que la firma caduque, aunque nadie abra el panel.

### Criterios de éxito

- Subir un `.p12` válido desde Configuración deja la facturación lista sin redesplegar ni tocar variables `SRI_P12_*`.
- El `.p12` y la contraseña nunca se guardan sin cifrar, nunca vuelven al navegador y no aparecen en logs ni errores.
- Un volcado o backup de la base de datos no permite usar la firma sin `SRI_ENCRYPTION_KEY`.
- Los administradores reciben un correo a los 30, 15, 7 y 1 día antes del vencimiento y el día que vence, cada uno una
  sola vez.
- Todas las páginas del panel muestran un banner cuando faltan 30 días o menos o la firma ya caducó.
- Se respetan las reglas P0 de `AGENTS.md` / `SECURITY.md`: sin clave secreta de Supabase en la app web, sin permisos a
  `anon`, RLS con `private.is_admin()`, `set search_path = ''` en todas las funciones.

### Fuera de alcance

- Rotación de `SRI_ENCRYPTION_KEY` (si cambia, se vuelve a subir la firma).
- Historial de firmas anteriores (solo hay una firma activa).
- Avisos por canales distintos del correo (WhatsApp, Slack, etc.).
- Avisos por correo cuando la firma sigue configurada solo con `SRI_P12_*` (la base no conoce su fecha; solo se muestra
  el banner del panel).

## Decisiones tomadas

| Tema | Decisión | Motivo |
| --- | --- | --- |
| Canal de aviso | Correo (Resend) + banner en el panel | El aviso debe llegar sin entrar al panel. |
| Almacenamiento | `.p12` y contraseña cifrados con AES-256-GCM en Postgres | La app solo usa la clave pública + sesión: lo que lee la app lo puede leer un admin vía PostgREST, así que la tabla solo debe contener texto cifrado. |
| Tarea diaria | `pg_cron` + `pg_net` dentro de Supabase | Leer la fecha sin sesión desde Vercel exigiría la clave secreta o permisos a `anon` (ambos P0). |
| Secretos del correo | Supabase Vault (`resend_api_key`, `alert_from_email`) | No se versionan ni se suben a Vercel. |

## Diseño

### 1. Esquema (migración nueva `supabase/migrations/<timestamp>_firma_electronica.sql`)

```sql
create table public.sri_certificates (
  id smallint primary key default 1 check (id = 1),   -- una sola firma activa
  p12_encrypted text not null,                          -- formato "v1:<base64(iv|tag|ciphertext)>"
  password_encrypted text not null,
  subject text not null,
  issuer text not null,
  serial_number text not null,
  valid_from timestamptz not null,
  valid_to timestamptz not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references auth.users (id) on delete set null,
  notified_days integer[] not null default '{}',       -- umbrales ya avisados (30, 15, 7, 1, 0)
  pending_alert_request_id bigint,                      -- id de net.http_post pendiente de confirmar
  pending_alert_day integer                              -- umbral asociado a esa petición
);
```

- `alter table ... enable row level security`.
- `revoke all ... from public, anon`; `grant select, insert, update, delete ... to authenticated`.
- Una política `for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))`.
- Columnas en claro: solo datos públicos del certificado. Las columnas `pending_*` y `notified_days` las escribe la
  función de avisos; la server action de subida reinicia `notified_days = '{}'` y las `pending_*` a `null`.

### 2. Cifrado (`src/lib/sri/crypto.ts`, nuevo, `server-only`)

- `encryptSecret(plain: Buffer, purpose: string): string` y `decryptSecret(value: string, purpose: string): Buffer`.
- AES-256-GCM con `node:crypto`, IV aleatorio de 12 bytes, tag de 16 bytes.
- `purpose` (`"sri_certificates.p12"` / `"sri_certificates.password"`) va como AAD para que no se puedan intercambiar
  los dos valores cifrados.
- Clave: `SRI_ENCRYPTION_KEY`, 32 bytes en base64. Si falta o no mide 32 bytes, se lanza
  `"Falta SRI_ENCRYPTION_KEY (32 bytes en base64) en las variables del servidor."` y no se guarda nada.
- Prefijo `v1:` para poder cambiar el formato en el futuro.
- Generar la clave: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

### 3. Lectura de la firma (`src/lib/sri/certificate.ts`)

- Se separa el parseo actual en `parseP12(der: Buffer, password: string): SigningCertificate` (reutilizado por la
  subida para validar).
- `getSigningCertificate()`:
  1. Con `createClient()` (sesión del admin, RLS) lee `id, uploaded_at` de `sri_certificates`.
  2. Si hay fila: la clave de caché es `db:<uploaded_at>`; si cambió, lee las columnas cifradas, descifra y parsea.
  3. Si no hay fila: usa `SRI_P12_BASE64` / `SRI_P12_PATH` + `SRI_P12_PASSWORD` como hoy (clave de caché `env`).
  4. Caché en memoria por instancia, invalidada al cambiar la clave de caché; así varias instancias de Vercel toman la
     firma nueva en su siguiente petición.
- `getCertificateStatus()` añade `source: "panel" | "env"`, `validFrom` y `daysLeft` (calculado con
  `todayInEcuador()`), y conserva `configured`, `expired`, `expiresSoon`.
- Llamadores actuales sin cambios de firma: `emit.ts`, inicio, configuración, `facturas/nueva`, `facturas/[id]`.

### 4. Subida y retiro (`src/app/admin/(panel)/configuracion/`)

- **`actions.ts`**
  - `uploadCertificate(formData: FormData): Promise<ActionResult<{ subject: string; validTo: string }>>`
    1. `adminClient()`.
    2. Archivo `p12`: obligatorio, extensión `.p12` o `.pfx`, tamaño ≤ 50 KB. Contraseña: `text(..., 200)`.
    3. `parseP12()`; si falla → `"No se pudo abrir el archivo .p12. Verifica el archivo y la contraseña."`.
    4. Rechaza certificados ya caducados.
    5. Cifra ambos valores y hace `upsert` de la fila `id = 1` con los metadatos, `uploaded_by`, `uploaded_at = now()`,
       `notified_days = '{}'` y `pending_* = null`.
    6. `revalidatePath("/admin", "layout")`.
  - `removeCertificate(): Promise<ActionResult<object>>` → `adminClient()`, `delete ... eq("id", 1)`,
    `revalidatePath`.
  - `sendCertificateTestEmail(): Promise<ActionResult<object>>` → `adminClient()`, `rpc("send_certificate_test_email")`.
- **`CertificateForm.tsx`** (nuevo, `"use client"`): input de archivo (`accept=".p12,.pfx"`), contraseña
  (`type="password"`, `autoComplete="off"`), botón «Subir firma», estado de carga y error; botón «Quitar firma» con
  `ConfirmDialog`; botón «Enviar correo de prueba».
- **`page.tsx`**: la tarjeta «Firma electrónica» muestra titular, emisor, vigencia, días restantes y origen
  (`Subida en el panel` / `Variables de entorno`), y monta `CertificateForm`. El texto que remite a las variables de
  entorno pasa a ser un respaldo opcional.

### 5. Avisos por correo (en la misma migración)

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

- **`private.send_alert_email(subject text, html text) returns bigint`** (security invoker, execute revocado a
  `public`, `anon` y `authenticated`)
  - Lee `resend_api_key` y `alert_from_email` de `vault.decrypted_secrets`; si falta alguno, `raise exception`.
  - Destinatarios: `select array_agg(u.email) from public.admin_users a join auth.users u on u.id = a.user_id`.
  - `net.http_post('https://api.resend.com/emails', body, headers => Authorization: Bearer ...)` y devuelve el id de la
    petición.
  - El asunto y el HTML se construyen con `format()` usando solo datos del certificado escapados (`%L` no aplica a
    HTML: los valores pasan por un `replace` de `&`, `<`, `>`, `"`).
- **`private.notify_certificate_expiry()`** (security invoker; la ejecuta `pg_cron` como `postgres`; execute revocado
  a `public`, `anon` y `authenticated`)
  1. **Confirmar la petición anterior:** si `pending_alert_request_id` no es nulo, busca la respuesta en
     `net._http_response`. Con `status_code` 2xx → limpia `pending_*`. Con error o status ≥ 300 → quita
     `pending_alert_day` de `notified_days` y limpia `pending_*` (se reintentará). Sin fila todavía → no hace nada más
     en esta ejecución.
  2. **Ventana horaria:** solo envía entre las 08:00 y las 20:00 de `America/Guayaquil`.
  3. `days_left := (valid_to at time zone 'America/Guayaquil')::date - (now() at time zone 'America/Guayaquil')::date`.
  4. Umbrales `{30, 15, 7, 1, 0}`: `due` = umbrales `t` con `days_left <= t` que no están en `notified_days`. Si `due`
     está vacío, termina.
  5. Envía **un solo correo** según el estado actual (`days_left > 0`: «La firma electrónica vence en N días»;
     `<= 0`: «La firma electrónica venció el …»), añade todos los `due` a `notified_days` y guarda
     `pending_alert_request_id` y `pending_alert_day = min(due)`.
- **`public.send_certificate_test_email()`** (security definer, `set search_path = ''`, execute solo para
  `authenticated`)
  - Justificación de `security definer`: necesita leer Vault y `auth.users`, que el rol `authenticated` no puede leer.
  - Primera instrucción: `if not private.is_admin() then raise exception 'No autorizado'; end if;`.
  - Envía un correo de prueba con el estado actual de la firma (o «sin firma subida») y no toca `notified_days`.
- **Programación:**
  `select cron.schedule('aviso-caducidad-firma', '0 * * * *', $$select private.notify_certificate_expiry()$$);`
  - Cada hora, para poder confirmar la respuesta de `pg_net` antes de que se borre (por defecto `pg_net` conserva las
    respuestas 6 horas; **verificar** el valor de `pg_net.ttl` del proyecto) y reintentar en el mismo día si Resend
    falla. La ventana de 08:00–20:00 evita correos de madrugada.

### 6. Banner en el panel

- `src/app/admin/(panel)/layout.tsx` llama a `getCertificateStatus()` y, sobre `{children}`, muestra:
  - `notice warning` si `0 < daysLeft <= 30`: «La firma electrónica vence en N días (fecha). Renovar».
  - `notice danger` si `expired`: «La firma electrónica CADUCÓ el (fecha). No puedes emitir facturas. Subir firma
    nueva».
  - Ambos enlazan a `/admin/configuracion`.
- Se elimina el banner `certExpiresSoon` de `src/app/admin/(panel)/page.tsx` para no duplicarlo. Se conserva el aviso
  «Falta configurar la firma» del inicio.

### 7. Documentación y configuración

- `.env.example`: añadir `SRI_ENCRYPTION_KEY=` con comentario; marcar `SRI_P12_*` como respaldo opcional.
- `README.md`: sección «Firma electrónica y avisos» con los pasos únicos:
  1. Generar `SRI_ENCRYPTION_KEY` y definirla en `.env.local` y en Vercel.
  2. Aplicar la migración.
  3. Crear cuenta en Resend y verificar el dominio `devnation.tech` (registros DNS).
  4. En el SQL Editor: `select vault.create_secret('re_…', 'resend_api_key');` y
     `select vault.create_secret('DevNation <avisos@devnation.tech>', 'alert_from_email');`.
  5. Subir la firma en Configuración y pulsar «Enviar correo de prueba».
- `SECURITY.md`: en *Controles existentes → Secretos*, documentar la firma cifrada con `SRI_ENCRYPTION_KEY`, los
  secretos en Vault y la función `security definer` `send_certificate_test_email` con su comprobación de admin; en la
  tabla de superficie de ataque, añadir la tarea `pg_cron`.

## Manejo de errores

| Situación | Resultado |
| --- | --- |
| Falta `SRI_ENCRYPTION_KEY` al subir | Error claro; no se guarda nada. |
| Falta `SRI_ENCRYPTION_KEY` con firma ya subida | `getCertificateStatus` → `configured: false` con el mensaje; la emisión queda bloqueada como hoy. |
| Contraseña incorrecta / archivo inválido / sin clave RSA | Error genérico de apertura; no se guarda nada. |
| Certificado ya caducado | Se rechaza la subida. |
| Faltan secretos en Vault | La tarea diaria lanza excepción (queda en `cron.job_run_details`); el botón de prueba muestra el error. |
| Resend responde error | El umbral se desmarca y se reintenta en la siguiente hora dentro de la ventana. |

Los mensajes devueltos al usuario no incluyen la contraseña, el contenido del `.p12` ni la API key.

## Verificación

No hay suite de pruebas automatizadas; se valida con:

1. `npm run lint`, `npx tsc --noEmit`, `npm run build`.
2. Un `.p12` autofirmado de prueba generado en el scratchpad (fuera del repo) con `node-forge`: subir, ver estado,
   quitar; probar contraseña incorrecta, archivo no `.p12` y certificado caducado.
3. Con acceso a Supabase: aplicar la migración, ejecutar `select private.notify_certificate_expiry();` con fechas
   simuladas y revisar `notified_days` y `net._http_response`.
4. **No cubierto por la verificación:** la entrega real del correo, que depende del dominio verificado en Resend y de
   la API key del usuario.
