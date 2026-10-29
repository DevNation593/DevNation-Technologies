# Política de seguridad

## Versiones soportadas

Solo la rama `main` (la versión desplegada en producción) recibe correcciones de seguridad.

| Versión | Soporte |
| --- | --- |
| `main` | ✅ |
| Otras ramas | ❌ |

## Reportar una vulnerabilidad

**No abras un issue público** para reportar una vulnerabilidad.

1. Usa el reporte privado de GitHub: pestaña **Security → Report a vulnerability** de este repositorio
   ([enlace directo](https://github.com/DevNation593/DevNation-Technologies/security/advisories/new)).
2. Si no puedes usar GitHub, escribe a **contacto@devnation.tech** con el asunto `[SEGURIDAD]`.

Incluye, en la medida de lo posible: la ruta o componente afectado, los pasos para reproducirlo, el impacto que
observaste y una propuesta de corrección. No accedas, modifiques ni extraigas datos de clientes o facturas reales para
demostrar el problema.

Confirmaremos la recepción en un máximo de **3 días hábiles** y te mantendremos al tanto hasta que se publique la
corrección. Agradeceremos públicamente tu reporte si así lo deseas.

## Superficie de ataque

| Área | Riesgo principal |
| --- | --- |
| Sitio público (`src/app/`, `src/components/`) | XSS, scripts de terceros cargados sin consentimiento, fuga de datos en metadatos. |
| Panel `/admin` | Acceso sin autorización, server actions invocadas directamente, escalada de un usuario autenticado que no es administrador. |
| Supabase (Postgres + Auth) | RLS mal configurado, permisos a `anon`, uso de la clave secreta fuera de `scripts/`. |
| Facturación SRI (`src/lib/sri/`) | Fuga del certificado `.p12` o su contraseña, inyección en el XML, alteración de comprobantes autorizados. |
| Cliente SOAP del SRI | Procesar respuestas XML no confiables (entidades externas, tamaños excesivos). |

## Controles existentes

Estos controles **no deben debilitarse** sin una justificación explícita en el PR:

- **Autenticación:** Supabase Auth con registro público desactivado; los administradores se crean solo con
  `npm run admin:create-user` (contraseña mínima de 10 caracteres).
- **Defensa en profundidad:**
  1. `src/proxy.ts` valida el JWT (`getClaims`) y redirige a quien no tiene sesión; además añade
     `X-Robots-Tag: noindex, nofollow` al panel.
  2. `requireAdmin()` / `adminClient()` (`src/lib/admin/auth.ts`) comprueba que el usuario exista en
     `public.admin_users` y cierra la sesión si no.
  3. RLS en todas las tablas con `private.is_admin()`; `anon` no tiene permisos.
- **Redirección segura:** el parámetro `next` del login solo acepta rutas que empiecen por `/admin` (`safeNextPath`).
- **Secretos:** solo en variables de entorno del servidor; `.env*`, `*.pem` y similares están en `.gitignore`.
  `SUPABASE_SECRET_KEY` no se sube al hosting.
- **Integridad de facturas:** el trigger `private.protect_authorized_invoice` impide modificar o borrar comprobantes
  autorizados o con clave de acceso, y la numeración se reserva de forma atómica con `next_document_number`.
- **Descargas:** el XML y el RIDE en PDF de las facturas se sirven con `Cache-Control: private, no-store` tras
  `requireAdmin()`.
- **Correo de facturas:** `RESEND_API_KEY` solo existe en las variables del servidor y nunca aparece en mensajes de
  error. Los destinatarios se validan (máximo 3, sin espacios, saltos de línea ni `<>`), así que no se pueden inyectar
  cabeceras; el HTML del correo escapa los datos del comprador y del emisor.
- **Privacidad:** Google Analytics solo se carga cuando la persona acepta las cookies de medición.

## Lista de verificación para revisiones

Los revisores (humanos o automáticos, ver [`AGENTS.md`](./AGENTS.md)) deben comprobar en cada PR:

### Autorización y sesión
- [ ] Toda server action, route handler o página nueva bajo `src/app/admin/` llama a `adminClient()` o
      `requireAdmin()` **antes** de tocar datos.
- [ ] No se confía en datos del cliente para decidir permisos (ids de usuario, roles, `created_by`).
- [ ] Las rutas nuevas fuera de `/admin` no exponen datos del panel.
- [ ] Las redirecciones usan rutas internas validadas.

### Base de datos
- [ ] Tablas nuevas con RLS habilitado y políticas basadas en `private.is_admin()`.
- [ ] Sin `grant` a `anon`; permisos mínimos a `authenticated`.
- [ ] Funciones con `set search_path = ''`; `security definer` solo con justificación.
- [ ] Cambios de esquema en una migración nueva, sin editar migraciones aplicadas.

### Secretos y datos sensibles
- [ ] Ningún secreto en código cliente, en `NEXT_PUBLIC_*`, en logs ni en mensajes devueltos al usuario.
- [ ] Ningún archivo `.env`, `.p12`, `.pem` o clave versionada.
- [ ] Los módulos con secretos importan `"server-only"`.
- [ ] Los errores mostrados al usuario no filtran trazas, SQL ni datos de otros registros.

### Entradas y salidas
- [ ] Toda entrada de server actions se sanea (`text()`, `number()`, catálogos SRI) con límites de longitud.
- [ ] El XML se construye escapando los valores; no se concatena texto del usuario sin escapar.
- [ ] Sin `dangerouslySetInnerHTML` con contenido no confiable (el JSON-LD escapa `<`).
- [ ] Las respuestas del SRI se tratan como datos no confiables.

### Facturación electrónica
- [ ] Una factura autorizada sigue siendo inmutable (solo puede pasar a `anulada`).
- [ ] No se reutilizan secuenciales ni claves de acceso; la numeración usa `next_document_number`.
- [ ] El ambiente de producción solo se usa cuando el usuario lo configura.
- [ ] El certificado y su contraseña nunca se registran ni se devuelven al cliente.
- [ ] El envío por correo valida los destinatarios con `parseRecipients` y no altera ninguna columna fiscal de la
      factura (solo `last_email*`).

### Dependencias y terceros
- [ ] Dependencias nuevas justificadas, con versión fijada en las críticas (`@supabase/*`, `node-forge`,
      `fast-xml-parser`) y sin vulnerabilidades conocidas (`npm audit`).
- [ ] Scripts o píxeles de terceros sujetos al consentimiento de cookies.

## Buenas prácticas para colaboradores

- Ejecuta `npm run lint`, `npx tsc --noEmit` y `npm run build` antes de abrir un PR.
- Usa el ambiente de **pruebas** del SRI y una base de Supabase local (`npx supabase start`) para desarrollar.
- Si un secreto se filtra (commit, log, captura), **rótalo de inmediato** (clave de Supabase, contraseña del `.p12`,
  credenciales de administradores) y avisa por el canal privado indicado arriba; borrar el commit no es suficiente.
