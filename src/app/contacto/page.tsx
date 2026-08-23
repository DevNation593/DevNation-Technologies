import Navbar from "@/components/Navbar";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Contacto",
  description:
    "Cuéntanos qué quieres crear o mejorar. Hablemos de tu próximo proyecto desde Quito para Ecuador y Latinoamérica.",
  path: "/contacto",
});

export default function ContactoPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <Contact />
      </main>
      <Footer />
    </>
  );
}
