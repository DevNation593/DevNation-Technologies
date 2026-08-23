import LegalLayout from "@/components/LegalLayout";
import { createPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata = createPageMetadata({
  title: "Política de cookies",
  description:
    "Conoce si usamos cookies, qué ocurre al abrir enlaces externos y cómo te avisaremos si esto cambia.",
  path: "/politica-cookies",
  noIndex: true,
});

export default function PoliticaCookies() {
  return (
    <LegalLayout title="Política de cookies" lastUpdated="23 de agosto de 2026">
      <section>
        <h2>1. Actualmente no usamos cookies</h2>
        <p>
          El sitio público de <strong>DevNation593</strong> no guarda cookies propias en tu dispositivo. Tampoco usamos
          servicios para medir tu actividad, mostrar publicidad o personalizar el contenido.
        </p>
        <p>
          Por eso no mostramos un aviso para aceptar cookies ni guardamos una preferencia. Si esto cambia, actualizaremos
          esta página antes de usar cookies que necesiten tu permiso.
        </p>
      </section>

      <section>
        <h2>2. Enlaces a otros sitios</h2>
        <p>
          Algunas imágenes o íconos pueden venir de otros servicios. También incluimos enlaces a redes sociales. Cuando
          abres uno de esos sitios, se aplican sus propias políticas. DevNation593 no controla las cookies que puedan usar.
        </p>
      </section>

      <section>
        <h2>3. Si esto cambia</h2>
        <p>
          Si añadimos una función que necesite cookies, explicaremos quién las crea, para qué sirven y cuánto tiempo
          duran. Cuando sea necesario, te pediremos permiso antes de usarlas.
        </p>
      </section>

      <section>
        <h2>4. Privacidad y contacto</h2>
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
