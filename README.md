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

Cada factura autorizada se envía automáticamente al comprador con el RIDE en PDF y el XML autorizado, por tu servidor
SMTP.

1. Define en `.env.local` y en el hosting (Vercel) las variables del servidor SMTP (solo servidor, nunca en
   `NEXT_PUBLIC_*`): `SMTP_HOST`, `SMTP_PORT` (465 usa TLS directo; en 587 STARTTLS es obligatorio y, si el servidor no lo
   ofrece, no se envía nada), `SMTP_USER` y
   `SMTP_PASSWORD`.
2. En **Configuración → Correo de facturación** comprueba que aparezca «Servidor SMTP: configurado» y escribe el
   remitente (p. ej. `DevNation Facturación <facturacion@devnation.tech>`). Debe ser una dirección que tu cuenta SMTP
   pueda usar, normalmente la misma de `SMTP_USER`. Opcionalmente, «Responder a» y una copia oculta.
3. Al quedar autorizada, la factura se envía una sola vez al correo del comprador (hasta 3 direcciones separadas por
   coma). Si el comprador no tiene correo no se envía nada; si falta la configuración SMTP o el remitente, el error
   queda visible en la factura para reenviarla cuando esté lista.
4. Desde una factura autorizada, **Reenviar por correo** permite enviarla de nuevo o a otros destinatarios. El
   resultado del último envío (o el error) queda visible en la factura.

Un fallo del correo nunca cambia el estado de la factura en el SRI.

### Firma electrónica y avisos de caducidad

La firma (`.p12` y su contraseña) se sube desde **Configuración → Firma electrónica** y se guarda **cifrada**
(AES-256-GCM) en la tabla `sri_certificates`; ni el archivo ni la contraseña vuelven al navegador. El aviso de
caducidad es un banner en todas las páginas del panel desde 30 días antes del vencimiento (rojo cuando ya caducó).

Configuración única:

1. Genera la clave de cifrado y defínela como `SRI_ENCRYPTION_KEY` en `.env.local` y en el hosting (Vercel). Si la
   pierdes o la cambias, vuelve a subir la firma.
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
2. Aplica las migraciones (`npx supabase db push`). Despliega el código **antes** de aplicar
   `20261030090000_quita_avisos_correo_firma.sql`: la versión anterior de la app todavía escribe las columnas que esa
   migración elimina, y la subida de la firma fallaría hasta el despliegue.
3. Sube la firma en Configuración.

Si antes configuraste los avisos por correo con Resend, borra sus secretos de Vault en el SQL Editor de Supabase
(ya no se usan): `delete from vault.secrets where name in ('resend_api_key', 'alert_from_email');`

Como respaldo, la firma también puede configurarse en variables del servidor:
`SRI_P12_PATH` (ruta local) o `SRI_P12_BASE64` (`base64 -w0 firma.p12`), y `SRI_P12_PASSWORD`. Si hay una firma
subida en el panel, esa tiene prioridad.

## Validación

```bash
npm run lint
npx tsc --noEmit
npm run build
```
