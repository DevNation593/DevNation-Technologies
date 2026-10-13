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

## Validación

```bash
npm run lint
npx tsc --noEmit
npm run build
```
