# AGENTS.md

Guía para agentes de IA (Codex / GPT, Claude, etc.) que trabajan o revisan código en este repositorio.

## Proyecto

Sitio corporativo de **DevNation Technologies** más un **panel administrativo privado** (`/admin`) con facturación
electrónica SRI (Ecuador), cotizaciones, contratos y clientes.

- **Stack:** Next.js 16 (App Router, React 19, React Compiler), TypeScript estricto, Tailwind CSS 4, Supabase
  (Auth + Postgres con RLS) vía `@supabase/ssr`, `node-forge` para la firma XAdES-BES y `fast-xml-parser` para las
  respuestas SOAP del SRI.
- **Idioma:** la interfaz, los mensajes de error, los comentarios y los commits están en **español**. Mantén ese idioma.
- **Commits:** Conventional Commits en español (`feat: …`, `fix: …`).

### Mapa del código

| Ruta | Contenido |
| --- | --- |
| `src/app/` (excepto `admin/`) | Sitio público: páginas, SEO (`robots.ts`, `sitemap.ts`, imágenes OG), páginas legales. |
| `src/components/` | Componentes del sitio público; `components/admin/` son los del panel. |
| `src/app/admin/login/` | Inicio de sesión y `signOut` (server actions). |
| `src/app/admin/(panel)/` | Panel protegido: cada módulo tiene `page.tsx`, un editor cliente y `actions.ts` (server actions). |
| `src/proxy.ts` | Proxy (antes `middleware`) que refresca la sesión y redirige a `/admin/login` a quien no tiene sesión. |
| `src/lib/admin/` | `auth.ts` (`requireAdmin`, `adminClient`), saneamiento de entradas (`server.ts`), consultas y tipos. |
| `src/lib/sri/` | Clave de acceso, XML de la factura v1.1.0, firma, cliente SOAP, cálculo de totales y validaciones. |
| `src/lib/supabase/` | Cliente de servidor y lectura de variables de entorno. |
| `supabase/migrations/` | Esquema, RLS, funciones y triggers (p. ej. inmutabilidad de facturas autorizadas). |
| `scripts/admin-users.mjs` | Alta/baja de administradores con la clave secreta de Supabase (solo local). |

### Comandos de validación

```bash
npm run lint
npx tsc --noEmit
npm run build
```

No hay suite de pruebas automatizadas; cualquier cambio debe pasar al menos los tres comandos anteriores.

## Convenciones

- Server Components por defecto; `"use client"` solo cuando haga falta estado o eventos del navegador.
- Todo módulo que maneje secretos, la sesión o el SRI importa `"server-only"`.
- Cada server action del panel empieza con `adminClient()` (o `requireAdmin()`), sanea la entrada con `text()` /
  `number()` de `src/lib/admin/server.ts` o validaciones contra los catálogos de `src/lib/sri/catalogs.ts`, y devuelve un
  `ActionResult` en lugar de lanzar errores al cliente.
- Los cambios de esquema van en una **migración nueva** en `supabase/migrations/`; nunca se edita una migración ya
  aplicada.
- Los importes monetarios se redondean a 2 decimales con la lógica de `src/lib/sri/totals.ts`; no dupliques cálculos.
- Las fechas de negocio usan la zona `America/Guayaquil` (`todayInEcuador()`).

## Review guidelines

Estas reglas aplican a las revisiones automáticas de pull requests (Codex code review / GPT) y a cualquier revisión
humana. **Escribe los comentarios de revisión en español.** Lee también [`SECURITY.md`](./SECURITY.md): su sección
*Lista de verificación para revisiones* forma parte de estas guías.

### Prioridades

Marca como **P0 / P1** (bloquean el merge):

1. **Autorización:** una server action, route handler o página bajo `src/app/admin/` que no llame a `adminClient()` /
   `requireAdmin()` antes de leer o escribir datos. El proxy por sí solo **no** es suficiente: las server actions se
   pueden invocar directamente por POST.
2. **Secretos expuestos:** `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SRI_P12_*` o cualquier clave privada
   usada en código cliente, en una variable `NEXT_PUBLIC_*`, en logs, en mensajes de error devueltos al usuario o
   versionada en el repositorio (`.env*`, `.p12`, `.pem`).
3. **RLS:** tablas nuevas sin `enable row level security`, políticas que no usen `private.is_admin()`, permisos
   concedidos a `anon`, funciones `security definer` sin `set search_path = ''`, o uso de la clave secreta / service
   role desde la aplicación web (solo se permite en `scripts/`).
4. **Integridad fiscal (SRI):** cambios que permitan editar o borrar una factura autorizada, reutilizar un secuencial o
   una clave de acceso, alterar el XML después de firmarlo, enviar a producción (`ambiente = 2`) sin que lo elija el
   usuario, o que rompan el redondeo/totales exigidos por el SRI. Debilitar el trigger
   `private.protect_authorized_invoice` es siempre P0.
5. **Inyección:** HTML/XML construido con datos del usuario sin escapar (revisa `src/lib/sri/xml.ts`),
   `dangerouslySetInnerHTML` con contenido no confiable, SQL dinámico en funciones de Postgres, redirecciones abiertas
   (el parámetro `next` del login debe seguir validado con `safeNextPath`).
6. **Fallos que pierden datos o rompen el build:** errores de tipos, excepciones no capturadas en server actions,
   condiciones de carrera en la numeración (usar siempre `next_document_number`).

Marca como **P2** (recomendado, no bloquea):

- Entradas sin límite de longitud o sin validar contra catálogos.
- Falta de `revalidatePath` tras una mutación, estados de carga o error ausentes en la UI.
- Cálculos duplicados, código muerto, nombres poco claros, textos de interfaz que no estén en español.
- Regresiones de SEO en el sitio público (metadatos, `canonical`, `sitemap`, imágenes OG) o de accesibilidad.
- Scripts de terceros que se carguen antes del consentimiento de cookies (`src/lib/cookie-consent.ts`).

### Qué no comentar

- Estilo que ya cubre ESLint, preferencias personales o reescrituras sin un problema concreto.
- Cambios de contenido o copy del sitio público, salvo errores evidentes.
- Archivos generados (`package-lock.json`, `next-env.d.ts`, `.next/`).

### Formato de cada hallazgo

Indica el archivo y la línea, explica **qué falla y en qué escenario concreto** (entrada → resultado incorrecto) y
propone la corrección mínima. Si no estás seguro, dilo y explica qué habría que verificar en lugar de afirmarlo.
