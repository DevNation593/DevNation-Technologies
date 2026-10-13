import CookiePreferencesButton from "@/components/CookiePreferencesButton";
import LegalLayout from "@/components/LegalLayout";
import { createPageMetadata } from "@/lib/seo";
import { cookieConsent, siteConfig } from "@/lib/site";

export const metadata = createPageMetadata({
  title: "Política de cookies",
  description:
    "Conoce qué cookies usamos, para qué sirven y cómo puedes aceptar o rechazar las de medición.",
  path: "/politica-cookies",
  noIndex: true,
});

export default function PoliticaCookies() {
  return (
    <LegalLayout title="Política de cookies" lastUpdated="12 de octubre de 2026">
      <section>
        <h2>1. Qué es una cookie</h2>
        <p>
          Una cookie es un archivo pequeño que un sitio guarda en tu navegador para recordar algo entre una visita y
          otra. El sitio de <strong>{siteConfig.name}</strong> usa dos tipos: una cookie necesaria y, solo si lo
          aceptas, cookies de medición.
        </p>
      </section>

      <section>
        <h2>2. Cookies que usamos</h2>

        <h3>2.1 Cookie necesaria</h3>
        <ul>
          <li><strong>Nombre:</strong> <code>{cookieConsent.name}</code></li>
          <li>
            <strong>Para qué sirve:</strong> recuerda si aceptaste o rechazaste las cookies de medición, para no
            preguntártelo en cada visita.
          </li>
          <li><strong>Quién la crea:</strong> {siteConfig.name}, desde este mismo sitio.</li>
          <li><strong>Cuánto dura:</strong> {cookieConsent.maxAgeDays} días desde que eliges una opción.</li>
          <li><strong>Qué guarda:</strong> solo tu decisión. No guarda datos personales.</li>
        </ul>
        <p>Como esta cookie es necesaria para que el aviso funcione, no requiere tu permiso.</p>

        <h3>2.2 Cookies de medición (solo si aceptas)</h3>
        <ul>
          <li>
            <strong>Nombres:</strong> <code>_ga</code> y otra cuyo nombre empieza por <code>_ga_</code>
          </li>
          <li>
            <strong>Para qué sirven:</strong> distinguen a un visitante de otro para saber cuántas personas visitan el
            sitio, qué páginas ven y desde qué país o tipo de dispositivo lo hacen.
          </li>
          <li>
            <strong>Quién las crea:</strong> Google Analytics, un servicio de Google que recibe esos datos de medición.
          </li>
          <li><strong>Cuánto duran:</strong> hasta 2 años.</li>
        </ul>
        <p>
          Estas cookies no se crean hasta que presionas «Aceptar» en el aviso. Si presionas «Rechazar», Google Analytics
          no se carga. Tenemos desactivadas sus funciones publicitarias: no usamos cookies para mostrar publicidad ni
          para personalizar el contenido.
        </p>
      </section>

      <section>
        <h2>3. Cómo cambiar tu decisión</h2>
        <p>
          Puedes aceptar o rechazar las cookies de medición en cualquier momento:{" "}
          <CookiePreferencesButton className="text-accent underline underline-offset-2 hover:text-accent-hover cursor-pointer">
            abrir las preferencias de cookies
          </CookiePreferencesButton>
          . También encontrarás ese enlace al pie del sitio. Si las rechazas después de haberlas aceptado, borramos las
          cookies de medición de tu navegador.
        </p>
        <p>
          Además puedes borrar o bloquear las cookies desde la configuración de tu navegador. El sitio seguirá
          funcionando igual; solo volverás a ver el aviso.
        </p>
      </section>

      <section>
        <h2>4. Enlaces a otros sitios</h2>
        <p>
          Algunas imágenes o íconos pueden venir de otros servicios. También incluimos enlaces a redes sociales. Cuando
          abres uno de esos sitios, se aplican sus propias políticas. {siteConfig.name} no controla las cookies que puedan usar.
        </p>
      </section>

      <section>
        <h2>5. Si esto cambia</h2>
        <p>
          Si añadimos otras cookies, actualizaremos esta página para explicar quién las crea, para qué sirven y cuánto
          tiempo duran. Cuando sea necesario, te pediremos permiso antes de usarlas.
        </p>
      </section>

      <section>
        <h2>6. Privacidad y contacto</h2>
        <p>
          Para saber cómo cuidamos tus datos personales, consulta nuestra{" "}
          <a href="/politica-privacidad">Política de privacidad y protección de datos</a>.
        </p>
        <p>
          Si tienes una pregunta sobre esta política, escribe a{" "}
          <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
