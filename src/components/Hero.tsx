"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-darker via-primary to-darker animate-gradient" />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-blue-400/10 rounded-full blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight"
        >
          Creamos software a medida
          <br />
          <span className="text-accent">para impulsar tu negocio</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="mt-6 text-lg md:text-xl text-muted max-w-2xl mx-auto leading-relaxed"
        >
          Diseñamos páginas web, aplicaciones móviles y sistemas en la nube
          que se adaptan a la forma en que trabaja tu empresa.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: "easeOut" }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/contacto"
            className="w-full sm:w-auto bg-accent hover:bg-accent-hover text-white font-semibold px-8 py-3.5 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-accent/25"
          >
            Cuéntanos tu idea
          </Link>
          <a
            href="#services"
            className="w-full sm:w-auto border border-border hover:border-muted text-white font-medium px-8 py-3.5 rounded-lg transition-all duration-200 hover:bg-white/5"
          >
            Conoce nuestros servicios
          </a>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-20"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="mx-auto w-6 h-10 border-2 border-muted/40 rounded-full flex items-start justify-center p-1.5"
          >
            <div className="w-1.5 h-1.5 bg-accent rounded-full" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
