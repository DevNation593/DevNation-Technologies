"use client";

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";

const services = [
  {
    title: "Desarrollo web",
    description: "Creamos páginas y sistemas web fáciles de usar, rápidos y adaptados a tu negocio.",
    iconName: "tabler:world-www",
  },
  {
    title: "Desarrollo móvil",
    description: "Desarrollamos aplicaciones para iOS y Android que funcionan de forma rápida y sencilla.",
    iconName: "tabler:device-mobile",
  },
  {
    title: "Soluciones en la nube",
    description: "Preparamos tus sistemas para que estén disponibles en línea, sean seguros y puedan crecer contigo.",
    iconName: "tabler:cloud-computing",
  },
  {
    title: "Diseño de interfaces",
    description: "Diseñamos pantallas claras para que las personas encuentren lo que necesitan sin complicaciones.",
    iconName: "tabler:palette",
  },
  {
    title: "Software a medida",
    description: "Creamos sistemas pensados para la manera en que tu empresa trabaja todos los días.",
    iconName: "tabler:code",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export default function Services() {
  return (
    <section id="services" className="py-24 md:py-32 bg-primary">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-accent text-sm font-semibold tracking-wider uppercase">
            Nuestros servicios
          </span>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold">
            Soluciones pensadas para tu negocio
          </h2>
          <p className="mt-4 text-muted max-w-2xl mx-auto">
            Te ayudamos a crear, mejorar y mantener las herramientas digitales
            que tu empresa necesita.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {services.map((service) => (
            <motion.div
              key={service.title}
              variants={cardVariants}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="group p-8 bg-card rounded-2xl border border-border hover:border-accent/40 transition-all duration-300"
            >
              <div className="w-12 h-12 bg-accent/10 text-accent rounded-xl flex items-center justify-center mb-5 group-hover:bg-accent/20 transition-colors">
                <Icon icon={service.iconName} className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
              <p className="text-muted text-sm leading-relaxed">
                {service.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
