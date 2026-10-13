import LegalLayout from "@/components/LegalLayout";
import { createPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata = createPageMetadata({
  title: "Términos y condiciones",
  description:
    `Conoce las reglas para usar el sitio de ${siteConfig.name} y contratar nuestros servicios.`,
  path: "/terminos-condiciones",
  noIndex: true,
});

export default function TerminosCondiciones() {
  return (
    <LegalLayout title="Términos y condiciones" lastUpdated="12 de octubre de 2026">
      <section>
        <h2>1. Sobre estos términos</h2>
        <p>
          Estos términos explican las reglas para usar el sitio web de <strong>{siteConfig.name}</strong> y para contratar
          nuestros servicios de desarrollo de software.
        </p>
        <p>
          Se aplican las leyes de Ecuador, entre ellas la{" "}
          <strong>Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos</strong> (Ley No. 2002-67), el{" "}
          <strong>Código Civil Ecuatoriano</strong>, el <strong>Código de Comercio</strong>, la{" "}
          <strong>Ley Orgánica de Defensa del Consumidor</strong> y las demás normas relacionadas.
        </p>
        <p>
          Al usar el sitio aceptas estos términos. Si no estás de acuerdo, te pedimos que no uses el sitio ni solicites
          nuestros servicios a través de él.
        </p>
      </section>

      <section>
        <h2>2. Quiénes somos</h2>
        <ul>
          <li><strong>Nombre comercial:</strong> {siteConfig.name}</li>
          <li><strong>Domicilio:</strong> {siteConfig.location}</li>
          <li>
            <strong>Correo electrónico:</strong>{" "}
            <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Servicios</h2>
        <p>{siteConfig.name} ofrece los siguientes servicios:</p>
        <ul>
          <li>Desarrollo de aplicaciones web</li>
          <li>Desarrollo de aplicaciones móviles</li>
          <li>Soluciones en la nube</li>
          <li>Diseño de pantallas y experiencias de uso</li>
          <li>Desarrollo de software a medida</li>
        </ul>
        <p>
          Antes de empezar un proyecto acordaremos por escrito qué incluye, cuánto costará, cuánto tiempo tomará y las
          demás condiciones importantes.
        </p>
      </section>

      <section>
        <h2>4. Cómo contratarnos</h2>

        <h3>4.1 Pasos para empezar</h3>
        <p>Normalmente trabajamos de esta manera:</p>
        <ol>
          <li>Nos cuentas qué necesitas.</li>
          <li>Preparamos una propuesta con el trabajo, el precio y el tiempo estimado.</li>
          <li>Revisamos los detalles y firmamos un contrato.</li>
          <li>Empezamos el proyecto siguiendo las fechas acordadas.</li>
        </ol>

        <h3>4.2 Precios y pagos</h3>
        <p>
          El precio y la forma de pago aparecerán en la propuesta o el contrato. Los pagos podrán hacerse por
          transferencia, depósito u otro medio acordado. Los impuestos se aplicarán según la ley ecuatoriana.
        </p>

        <h3>4.3 Fechas de entrega</h3>
        <p>
          Las fechas se definirán en el contrato. Haremos lo posible por cumplirlas, excepto cuando ocurra una situación
          fuera de nuestro control o cuando ambas partes acuerden un cambio.
        </p>
      </section>

      <section>
        <h2>5. Propiedad intelectual</h2>
        <p>
          El contenido del sitio y el trabajo realizado en cada proyecto están protegidos por las leyes ecuatorianas
          de propiedad intelectual. Se aplican las siguientes reglas:
        </p>
        <ul>
          <li>
            Los textos, gráficos, logotipos, imágenes, diseños y código del sitio pertenecen a {siteConfig.name}, salvo que
            se indique lo contrario.
          </li>
          <li>
            Los derechos sobre el trabajo creado para un cliente se entregarán cuando se complete el pago, salvo que el
            contrato indique algo diferente.
          </li>
          <li>
            Podemos mostrar un proyecto en nuestro portafolio, excepto cuando exista un acuerdo de confidencialidad.
          </li>
          <li>
            No se puede copiar, publicar o modificar el contenido del sitio sin nuestro permiso escrito.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Uso responsable del sitio</h2>
        <p>Al usar el sitio te comprometes a:</p>
        <ul>
          <li>Compartir información verdadera y actualizada.</li>
          <li>No usarlo para actividades ilegales.</li>
          <li>No intentar entrar sin permiso a nuestros sistemas o datos.</li>
          <li>No enviar virus ni archivos dañinos.</li>
          <li>Respetar nuestros derechos y los de otras personas.</li>
          <li>
            No copiar ni usar comercialmente el contenido sin permiso.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Garantías y responsabilidades</h2>

        <h3>7.1 Garantía del trabajo</h3>
        <p>
          Revisaremos y corregiremos los problemas incluidos en la garantía definida en cada contrato, conforme a la{" "}
          <strong>Ley Orgánica de Defensa del Consumidor</strong>.
        </p>

        <h3>7.2 Límites de responsabilidad</h3>
        <p>No podemos hacernos responsables por:</p>
        <ul>
          <li>Daños indirectos causados por el uso del sitio.</li>
          <li>Interrupciones causadas por hechos fuera de nuestro control.</li>
          <li>Problemas causados por un uso incorrecto del sistema entregado.</li>
          <li>El contenido o funcionamiento de otros sitios enlazados.</li>
        </ul>

        <h3>7.3 Disponibilidad del sitio</h3>
        <p>
          Procuramos mantener el sitio disponible, pero puede dejar de funcionar temporalmente por mantenimiento o por
          situaciones fuera de nuestro control.
        </p>
      </section>

      <section>
        <h2>8. Confidencialidad</h2>
        <p>
          Ambas partes deben cuidar la información privada que compartan durante el proyecto. Esta obligación continúa
          después de terminar el trabajo, según lo acordado en el contrato.
        </p>
      </section>

      <section>
        <h2>9. Cancelación</h2>
        <ul>
          <li>
            El cliente puede cancelar un servicio avisando por escrito. La posibilidad de un reembolso dependerá del
            avance del trabajo y de lo indicado en el contrato.
          </li>
          <li>
            {siteConfig.name} puede terminar el contrato si el cliente no cumple lo acordado, después de avisarle por escrito.
          </li>
          <li>
            El cliente deberá pagar el trabajo realizado hasta la fecha de cancelación.
          </li>
        </ul>
      </section>

      <section>
        <h2>10. Datos personales</h2>
        <p>
          Usaremos tus datos según nuestra{" "}
          <a href="/politica-privacidad">Política de privacidad y protección de datos</a> y la{" "}
          <strong>Ley Orgánica de Protección de Datos Personales (LOPDP)</strong> del Ecuador.
        </p>
      </section>

      <section>
        <h2>11. Ley aplicable y solución de desacuerdos</h2>
        <p>
          Estos términos se rigen por las leyes de Ecuador. Si surge un desacuerdo, seguiremos este orden:
        </p>
        <ol>
          <li>
            <strong>Mediación:</strong> Primero intentaremos llegar a un acuerdo con ayuda de un centro autorizado.
          </li>
          <li>
            <strong>Arbitraje:</strong> Si no hay acuerdo, las partes podrán acudir a arbitraje según la ley ecuatoriana.
          </li>
          <li>
            <strong>Vía judicial:</strong> Como última opción, el caso podrá presentarse ante los jueces de Quito, Ecuador.
          </li>
        </ol>
      </section>

      <section>
        <h2>12. Si una parte no puede aplicarse</h2>
        <p>
          Si una autoridad determina que una parte de estos términos no es válida, las demás partes seguirán vigentes.
        </p>
      </section>

      <section>
        <h2>13. Modificaciones</h2>
        <p>
          Podemos actualizar estos términos cuando sea necesario. La nueva versión se aplicará desde que sea publicada
          en el sitio.
        </p>
      </section>

      <section>
        <h2>14. Contacto</h2>
        <p>
          Si tienes una pregunta sobre estos términos, puedes escribirnos a:
        </p>
        <ul>
          <li>
            <strong>Correo electrónico:</strong>{" "}
            <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
          </li>
          <li><strong>Dirección:</strong> {siteConfig.location}</li>
        </ul>
      </section>
    </LegalLayout>
  );
}
