# DevNation Technologies

Sitio corporativo construido con Next.js.

## Desarrollo local

```bash
npm install
npm run dev
```

## Configuración para producción

Copia `.env.example` como `.env.local` y define:

- `NEXT_PUBLIC_SITE_URL`: origen público definitivo, sin una barra final. Se utiliza en etiquetas canónicas, Open Graph, datos estructurados, `robots.txt` y `sitemap.xml`.
- `NEXT_PUBLIC_CONTACT_EMAIL`: buzón que recibirá las consultas preparadas desde el formulario.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: ID de medición de Google Analytics 4 (formato `G-XXXXXXXXXX`). Si queda vacío, Google Analytics no se carga. Solo se activa cuando la persona acepta las cookies de medición.

Antes de publicar, verifica también que el dominio y el buzón configurado en `src/lib/site.ts` tengan DNS activo.

## Panel administrativo (`/admin`)

Facturación electrónica SRI, cotizaciones (proformas), contratos y clientes. Los datos viven en Supabase y solo
acceden los usuarios dados de alta por comando (no hay registro público).

### Base de datos

1. Crea un proyecto en Supabase y aplica la migración de `supabase/migrations/`:
   ```bash
   npx supabase link --project-ref TU_PROJECT_REF
   npx supabase db push
   ```
2. En el panel de Supabase, **Authentication → Sign In / Providers**, desactiva *Allow new users to sign up*.
3. Define en `.env.local` (y en el hosting) `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   `SUPABASE_SECRET_KEY` solo se usa en tu equipo para los comandos de usuarios; no la subas al hosting.

Para desarrollo local, `npx supabase start` levanta Supabase en Docker con la misma migración; `npx supabase status`
muestra la URL y las claves.

### Usuarios

```bash
npm run admin:create-user -- --email ana@devnation.tech --name "Ana Pérez"
npm run admin:list-users
npm run admin:remove-user -- --email ana@devnation.tech
```

`admin:create-user` pide la contraseña por consola (mínimo 10 caracteres); si el usuario ya existe, la actualiza.

### Facturación electrónica

1. En **Configuración** completa RUC, razón social, dirección matriz, régimen, establecimiento y punto de emisión.
2. Sube la firma electrónica `.p12` en **Configuración → Firma electrónica** (ver «Firma electrónica y avisos de caducidad»).
3. Emite primero en ambiente de **pruebas**. Cuando el SRI habilite tu RUC en producción, cambia el ambiente en
   Configuración; si ya emitiste facturas en otro sistema, ajusta el próximo secuencial.

Flujo de emisión: se asigna el secuencial y la clave de acceso, se genera el XML (factura v1.1.0), se firma con
XAdES-BES y se envía a recepción; luego se consulta la autorización. Si el SRI **devuelve** el comprobante se corrige y
se reenvía con la misma clave; si queda **no autorizado** se reemite con un número nuevo. Una factura autorizada no se
puede editar ni borrar: solo marcarse como anulada (la anulación se solicita en el portal del SRI). El RIDE se imprime
o guarda como PDF desde el navegador, y desde la factura se descargan el RIDE en PDF y el XML autorizado.

### Envío de facturas por correo

Cada factura autorizada puede enviarse al comprador con el RIDE en PDF y el XML autorizado, usando
[Resend](https://resend.com).

1. Crea una cuenta en Resend y verifica el dominio `devnation.tech` (registros DNS).
2. Define `RESEND_API_KEY` en `.env.local` y en el hosting (Vercel). Es solo del servidor: nunca en `NEXT_PUBLIC_*`.
   Puede ser la misma API key que guardaste en Vault para los avisos de la firma.
3. En **Configuración → Correo de facturación** escribe el remitente (p. ej.
   `DevNation Facturación <facturacion@devnation.tech>`), y opcionalmente «Responder a» y una copia oculta.
4. Activa «Enviar automáticamente cada factura autorizada al comprador»: al quedar autorizada, se envía al correo del
   comprador (hasta 3 direcciones separadas por coma) una sola vez.
5. Desde una factura autorizada, **Reenviar por correo** permite enviarla de nuevo o a otros destinatarios. El
   resultado del último envío (o el error) queda visible en la factura.

Un fallo del correo nunca cambia el estado de la factura en el SRI.

### Firma electrónica y avisos de caducidad

La firma (`.p12` y su contraseña) se sube desde **Configuración → Firma electrónica** y se guarda **cifrada**
(AES-256-GCM) en la tabla `sri_certificates`; ni el archivo ni la contraseña vuelven al navegador. Supabase avisa por
correo a todos los administradores 30, 15, 7 y 1 día antes del vencimiento y el día que vence, y el panel muestra un
banner en todas las páginas desde 30 días antes.

Configuración única:

1. Genera la clave de cifrado y defínela como `SRI_ENCRYPTION_KEY` en `.env.local` y en el hosting (Vercel). Si la
   pierdes o la cambias, vuelve a subir la firma.
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
2. Aplica la migración (`npx supabase db push`). Activa `pg_cron` y `pg_net` y programa la revisión cada hora.
3. Crea una cuenta en [Resend](https://resend.com) y verifica el dominio `devnation.tech` (registros DNS).
4. En el SQL Editor de Supabase guarda los secretos en Vault (no se versionan):
   ```sql
   select vault.create_secret('re_...', 'resend_api_key');
   select vault.create_secret('DevNation <avisos@devnation.tech>', 'alert_from_email');
   ```
5. Sube la firma en Configuración y pulsa **Enviar correo de prueba**.

Los correos solo salen entre las 08:00 y las 20:00 de Ecuador; si Resend falla, se reintenta en la hora siguiente. El
historial de ejecuciones está en `cron.job_run_details`. Los avisos por correo solo funcionan con la firma subida en el
panel.

Como respaldo (sin avisos por correo), la firma también puede configurarse en variables del servidor:
`SRI_P12_PATH` (ruta local) o `SRI_P12_BASE64` (`base64 -w0 firma.p12`), y `SRI_P12_PASSWORD`. Si hay una firma
subida en el panel, esa tiene prioridad.

## Validación

```bash
npm run lint
npx tsc --noEmit
npm run build
```
