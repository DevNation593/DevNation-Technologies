import LegalLayout from "@/components/LegalLayout";
import { createPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata = createPageMetadata({
  title: "Política de privacidad y protección de datos",
  description:
    "Conoce qué información podemos recibir, para qué la usamos y cómo cuidamos tus datos personales.",
  path: "/politica-privacidad",
  noIndex: true,
});

export default function PoliticaPrivacidad() {
  return (
    <LegalLayout
      title="Política de privacidad y protección de datos"
      lastUpdated="12 de octubre de 2026"
    >
      <section>
        <h2>1. Alcance</h2>
        <p>
          Esta página explica qué información podemos recibir cuando visitas el sitio o nos escribes, para qué la
          usamos y cómo la cuidamos.
        </p>
        <p>
          En <strong>{siteConfig.name}</strong> cuidamos tus datos y cumplimos con la{" "}
          <a
            href="https://www.registroficial.gob.ec/quinto-suplemento-al-registro-oficial-no-459/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ley Orgánica de Protección de Datos Personales del Ecuador (LOPDP)
          </a>{" "}
          y las demás normas que correspondan.
        </p>
      </section>

      <section>
        <h2>2. Quién cuida tus datos</h2>
        <ul>
          <li><strong>Responsable:</strong> {siteConfig.name}</li>
          <li><strong>Ubicación:</strong> {siteConfig.location}</li>
          <li>
            <strong>Correo electrónico:</strong>{" "}
            <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Información que podemos recibir</h2>
        <h3>3.1 Lo que decides enviarnos</h3>
        <p>
          Cuando nos escribes, podemos recibir tu nombre, correo, empresa y los detalles que compartas sobre tu idea o
          proyecto. El formulario solo prepara un borrador en tu aplicación de correo; no guarda ni envía los datos por
          sí mismo.
        </p>

        <h3>3.2 Datos básicos de navegación</h3>
        <p>
          Las empresas que nos ayudan a mantener el sitio en línea y seguro pueden guardar datos básicos, como la
          dirección IP, el navegador y la fecha de visita. No mostramos publicidad personalizada ni creamos perfiles sobre ti.
        </p>

        <h3>3.3 Medición de visitas</h3>
        <p>
          Si aceptas las cookies de medición, usamos Google Analytics para saber cuántas personas visitan el sitio, qué
          páginas ven y desde qué país o tipo de dispositivo lo hacen. Google recibe esos datos mediante cookies; no los
          usamos para identificarte y tenemos desactivadas sus funciones publicitarias. Si las rechazas, Google
          Analytics no se carga.
        </p>
        <p>
          También usamos una cookie propia, necesaria para recordar tu decisión. Puedes leer más en nuestra{" "}
          <a href="/politica-cookies">Política de cookies</a>.
        </p>
      </section>

      <section>
        <h2>4. Para qué usamos la información</h2>
        <p>Solo usamos la información para:</p>
        <ul>
          <li>Responder tus preguntas y preparar una cotización.</li>
          <li>Prestar nuestros servicios cuando decides trabajar con nosotros.</li>
          <li>Mantener el sitio disponible y seguro.</li>
          <li>Saber cómo se usa el sitio para mejorarlo, solo si aceptas las cookies de medición.</li>
          <li>Cumplir la ley cuando sea necesario.</li>
        </ul>
        <p>
          Usamos tus datos cuando nos das permiso, cuando nos pides una cotización, cuando contratas un servicio o
          cuando la ley lo exige. También podemos usar la información mínima necesaria para mantener el sitio seguro,
          siempre respetando tus derechos.
        </p>
      </section>

      <section>
        <h2>5. Con quién podemos compartirla</h2>
        <p>
          No vendemos tus datos. Solo pueden acceder a ellos las empresas que nos ayudan con el alojamiento del sitio,
          la seguridad y el correo, y Google, que nos presta el servicio de medición de visitas cuando lo aceptas.
          Algunas pueden trabajar fuera de Ecuador; si esto ocurre, cuidaremos que se cumplan
          las medidas de protección exigidas por la ley.
        </p>
      </section>

      <section>
        <h2>6. Durante cuánto tiempo guardamos los datos</h2>
        <p>
          Guardamos las consultas durante el tiempo necesario para responderlas, continuar la conversación y cumplir
          nuestras obligaciones legales. Los datos básicos de navegación se guardan durante el plazo definido por las
          empresas que mantienen el sitio. Después se eliminan o dejan de poder relacionarse contigo.
        </p>
        <p>
          Los datos de medición se guardan en Google Analytics por un máximo de 14 meses. Sus cookies duran hasta 2
          años, salvo que las borres o retires tu permiso antes.
        </p>
      </section>

      <section>
        <h2>7. Tus derechos</h2>
        <p>
          Puedes pedirnos que te digamos qué datos tenemos, que los corrijamos, actualicemos, eliminemos, dejemos de
          usarlos o te entreguemos una copia. También puedes oponerte a decisiones tomadas únicamente por sistemas
          automáticos; este sitio no toma ese tipo de decisiones.
        </p>
        <p>
          Puedes retirar tu permiso para las cookies de medición en cualquier momento desde el enlace «Preferencias de
          cookies», al pie del sitio.
        </p>
        <p>
          Para pedirlo, escribe a <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>, dinos qué necesitas e
          incluye la información necesaria para confirmar tu identidad. Responderemos dentro del plazo que establece la
          ley. También puedes presentar un reclamo ante la Superintendencia de Protección de Datos Personales del Ecuador.
        </p>
      </section>

      <section>
        <h2>8. Seguridad</h2>
        <p>
          Tomamos precauciones razonables para cuidar la información. Ningún sistema es completamente infalible; si
          ocurre un problema que afecte datos personales, revisaremos lo sucedido y avisaremos cuando la ley lo exija.
        </p>
      </section>

      <section>
        <h2>9. Menores de edad</h2>
        <p>
          Nuestros servicios están dirigidos a empresas y personas adultas. No buscamos recibir datos de menores de edad.
        </p>
      </section>

      <section>
        <h2>10. Cambios y contacto</h2>
        <p>
          Actualizaremos esta política si cambia el sitio, las empresas que nos ayudan a operarlo o la ley. La fecha que
          aparece al inicio corresponde a la versión más reciente.
        </p>
        <p>
          Para cualquier consulta sobre privacidad o protección de datos, escribe a{" "}
          <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
