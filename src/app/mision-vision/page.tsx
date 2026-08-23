import Navbar from "@/components/Navbar";
import MissionVision from "@/components/MissionVision";
import Footer from "@/components/Footer";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Misión, visión y valores",
  description:
    "Conoce qué nos mueve, hacia dónde queremos llegar y cómo trabajamos con cada cliente.",
  path: "/mision-vision",
});

export default function MisionVisionPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <MissionVision />
      </main>
      <Footer />
    </>
  );
}
