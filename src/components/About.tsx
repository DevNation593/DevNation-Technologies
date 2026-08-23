"use client";

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";

export default function About() {
  return (
    <section id="about" className="py-24 md:py-32 bg-darker">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <span className="text-accent text-sm font-semibold tracking-wider uppercase">
              Sobre nosotros
            </span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold leading-tight">
              Convertimos tus ideas en{" "}
              <span className="text-accent">soluciones que funcionan</span>
            </h2>
            <p className="mt-6 text-muted leading-relaxed">
              Somos un equipo de desarrollo de software en Quito. Trabajamos con
              empresas y emprendimientos que necesitan una página, una aplicación
              o un sistema hecho para su forma de trabajar.
            </p>
            <p className="mt-4 text-muted leading-relaxed">
              Te acompañamos desde la idea inicial hasta el lanzamiento. Primero
              entendemos lo que necesitas y después elegimos la mejor manera de
              construirlo, sin complicaciones innecesarias.
            </p>
          </motion.div>

          {/* Right — values */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="grid grid-cols-2 gap-4"
          >
            {[
              {
                title: "Escuchamos",
                desc: "Conocemos tu idea, tus necesidades y las personas que usarán la solución.",
                iconName: "tabler:search",
              },
              {
                title: "Proponemos",
                desc: "Te mostramos opciones claras y te ayudamos a elegir la más conveniente.",
                iconName: "tabler:route",
              },
              {
                title: "Construimos",
                desc: "Compartimos avances frecuentes para que puedas revisar el resultado.",
                iconName: "tabler:iterations",
              },
              {
                title: "Acompañamos",
                desc: "Seguimos contigo después del lanzamiento para resolver dudas y mejorar.",
                iconName: "tabler:trending-up",
              },
            ].map((item) => (
              <motion.div
                key={item.title}
                whileHover={{ y: -4 }}
                className="p-5 bg-card rounded-xl border border-border hover:border-accent/30 transition-colors"
              >
                <div className="w-10 h-10 bg-accent/10 text-accent rounded-lg flex items-center justify-center mb-3">
                  <Icon icon={item.iconName} className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-sm">{item.title}</h3>
                <p className="text-muted text-xs mt-1 leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
