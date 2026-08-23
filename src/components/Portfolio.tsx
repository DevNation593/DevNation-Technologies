"use client";

import { motion } from "framer-motion";

const projects = [
  {
    title: "FinTrack Pro",
    description:
      "Una herramienta para controlar las finanzas de una empresa, consultar movimientos al instante y crear reportes sin trabajo manual.",
    technologies: ["Next.js", "Node.js", "PostgreSQL", "AWS"],
    gradient: "from-blue-600/20 to-cyan-600/20",
  },
  {
    title: "NuVet",
    description:
      "Un sistema para clínicas veterinarias que reúne citas, historias de pacientes, facturas y tratamientos en un solo lugar.",
    technologies: ["Next.js", "Node.js", "PostgreSQL", "TailwindCSS"],
    gradient: "from-emerald-600/20 to-teal-600/20",
  },
  {
    title: "Sistema para consultorios psicológicos",
    description:
      "Una herramienta para organizar sesiones, guardar expedientes, planificar terapias y dar seguimiento al progreso de cada paciente.",
    technologies: ["React", "TailwindCSS", "PostgreSQL", "AWS"],
    gradient: "from-purple-600/20 to-pink-600/20",
  },
];

export default function Portfolio() {
  return (
    <section id="portfolio" className="py-24 md:py-32 bg-primary">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-accent text-sm font-semibold tracking-wider uppercase">
            Proyectos
          </span>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold">
            Algunos proyectos en los que hemos trabajado
          </h1>
          <p className="mt-4 text-muted max-w-2xl mx-auto">
            Soluciones creadas para ordenar tareas, ahorrar tiempo y facilitar
            el trabajo diario de distintos negocios.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {projects.map((project, i) => (
            <motion.div
              key={project.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="group bg-card rounded-2xl border border-border hover:border-accent/40 overflow-hidden transition-all duration-300"
            >
              {/* Preview area */}
              <div
                className={`h-48 bg-gradient-to-br ${project.gradient} flex items-center justify-center relative overflow-hidden`}
              >
                <div className="absolute inset-0 opacity-10" style={{
                  backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)",
                  backgroundSize: "24px 24px"
                }} />
                <div className="relative text-3xl font-bold text-white/30 group-hover:text-white/50 transition-colors">
                  {project.title.charAt(0)}{project.title.split(" ")[1]?.charAt(0) || ""}
                </div>
              </div>

              <div className="p-6">
                <h3 className="text-lg font-semibold mb-2">{project.title}</h3>
                <p className="text-muted text-sm leading-relaxed mb-4">
                  {project.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {project.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="text-xs px-2.5 py-1 bg-accent/10 text-accent rounded-md font-medium"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
