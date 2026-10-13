"use client";

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";

const values = [
  {
    title: "Integridad",
    description:
      "Hablamos con honestidad, cumplimos lo acordado y construimos relaciones basadas en la confianza.",
    iconName: "tabler:shield-heart",
  },
  {
    title: "Ideas que aportan",
    description:
      "Buscamos nuevas formas de resolver cada reto, pero solo usamos lo que aporta un beneficio real.",
    iconName: "tabler:rocket",
  },
  {
    title: "Trabajo bien hecho",
    description:
      "Cuidamos los detalles y revisamos nuestro trabajo para entregar soluciones confiables.",
    iconName: "tabler:award",
  },
  {
    title: "Trabajo en equipo",
    description:
      "Escuchamos a nuestros clientes y tomamos las decisiones importantes junto a ellos.",
    iconName: "tabler:users-group",
  },
  {
    title: "Compromiso",
    description:
      "Nos hacemos cargo de nuestro trabajo y cuidamos la información y la confianza de cada cliente.",
    iconName: "tabler:certificate",
  },
  {
    title: "Aprendizaje continuo",
    description:
      "Seguimos aprendiendo para mejorar nuestro trabajo y ofrecer soluciones cada vez más útiles.",
    iconName: "tabler:book",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export default function MissionVision() {
  return (
    <section id="mission-vision" className="py-24 md:py-32 bg-primary">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-accent text-sm font-semibold tracking-wider uppercase">
            Lo que nos guía
          </span>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold">
            Misión, visión y valores
          </h1>
          <p className="mt-4 text-muted max-w-2xl mx-auto">
            Estas ideas muestran por qué hacemos nuestro trabajo y cómo queremos
            relacionarnos con cada cliente.
          </p>
        </motion.div>

        {/* Mission & Vision Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {/* Mission */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="relative p-8 md:p-10 bg-card rounded-2xl border border-border overflow-hidden group hover:border-accent/40 transition-all duration-300"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-blue-400" />
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 bg-accent/10 text-accent rounded-xl flex items-center justify-center shrink-0">
                <Icon icon="tabler:target-arrow" className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold">Nuestra misión</h2>
            </div>
            <p className="text-muted leading-relaxed">
              Ayudar a empresas y emprendimientos de Ecuador y Latinoamérica a
              convertir sus ideas en herramientas digitales útiles. Escuchamos sus
              necesidades, buscamos una solución sencilla y construimos algo que les
              ayude a trabajar mejor y seguir creciendo.
            </p>
          </motion.div>

          {/* Vision */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="relative p-8 md:p-10 bg-card rounded-2xl border border-border overflow-hidden group hover:border-accent/40 transition-all duration-300"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-accent" />
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 bg-accent/10 text-accent rounded-xl flex items-center justify-center shrink-0">
                <Icon icon="tabler:eye" className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold">Nuestra visión</h2>
            </div>
            <p className="text-muted leading-relaxed">
              Convertirnos en un equipo de confianza para empresas de Ecuador y la
              región. Queremos que nos elijan por escuchar, cumplir lo acordado y
              crear soluciones que sean fáciles de usar y aporten resultados reales.
            </p>
          </motion.div>
        </div>

        {/* Values */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold">
            Nuestros <span className="text-accent">valores</span>
          </h2>
          <p className="mt-3 text-muted max-w-xl mx-auto">
            Las ideas que ponemos en práctica cada día y en cada proyecto.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {values.map((value) => (
            <motion.div
              key={value.title}
              variants={cardVariants}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="group p-7 bg-card rounded-2xl border border-border hover:border-accent/40 transition-all duration-300"
            >
              <div className="w-11 h-11 bg-accent/10 text-accent rounded-xl flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <Icon icon={value.iconName} className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
              <p className="text-muted text-sm leading-relaxed">
                {value.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
