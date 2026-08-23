import Navbar from "@/components/Navbar";
import Portfolio from "@/components/Portfolio";
import Footer from "@/components/Footer";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Portafolio de desarrollo de software",
  description:
    "Mira algunos de los sistemas y aplicaciones que hemos creado para empresas de Ecuador y Latinoamérica.",
  path: "/portafolio",
});

export default function PortafolioPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <Portfolio />
      </main>
      <Footer />
    </>
  );
}
