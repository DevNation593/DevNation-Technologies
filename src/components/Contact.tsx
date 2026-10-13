"use client";

import { motion } from "framer-motion";
import { FormEvent, useState } from "react";
import { Icon } from "@iconify/react";
import { siteConfig } from "@/lib/site";

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const message = String(formData.get("message") ?? "");
    const subject = encodeURIComponent(`Quiero conversar sobre un proyecto — ${name}`);
    const body = encodeURIComponent(
      `Nombre: ${name}\nCorreo: ${email}\n\nProyecto:\n${message}`,
    );

    window.location.href = `mailto:${siteConfig.email}?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <section id="contact" className="py-24 md:py-32 bg-primary">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-accent text-sm font-semibold tracking-wider uppercase">
            Hablemos
          </span>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold">
            Cuéntanos sobre tu proyecto
          </h1>
          <p className="mt-4 text-muted max-w-2xl mx-auto">
            Completa tus datos y se abrirá un correo listo para enviarnos.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center h-full p-12 bg-card rounded-2xl border border-accent/30 text-center"
                role="status"
              >
                <div className="w-16 h-16 bg-accent/20 text-accent rounded-full flex items-center justify-center mb-4">
                  <Icon icon="tabler:check" className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Tu correo está listo</h2>
                <p className="text-muted text-sm">
                  Solo falta enviarlo desde tu aplicación de correo. Si no se abrió,
                  puedes escribirnos directamente a {siteConfig.email}.
                </p>
              </motion.div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-5 p-8 bg-card rounded-2xl border border-border"
              >
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-2">
                    Nombre
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    autoComplete="name"
                    className="w-full bg-darker border border-border rounded-lg px-4 py-3 text-sm text-white placeholder:text-muted/60 focus:outline-none focus:border-accent transition-colors"
                    placeholder="Tu nombre"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    autoComplete="email"
                    className="w-full bg-darker border border-border rounded-lg px-4 py-3 text-sm text-white placeholder:text-muted/60 focus:outline-none focus:border-accent transition-colors"
                    placeholder="tu@empresa.com"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-2">
                    Cuéntanos qué necesitas
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                    className="w-full bg-darker border border-border rounded-lg px-4 py-3 text-sm text-white placeholder:text-muted/60 focus:outline-none focus:border-accent transition-colors resize-none"
                    placeholder="Describe brevemente tu idea o necesidad..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3.5 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-accent/25"
                >
                  Abrir mi correo
                </button>
              </form>
            )}
          </motion.div>

          {/* Contact info */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="flex flex-col justify-center gap-8"
          >
            <div>
              <h2 className="text-lg font-semibold mb-4">También puedes encontrarnos en</h2>
              <p className="text-muted text-sm leading-relaxed mb-8">
                Escríbenos directamente o visita nuestros perfiles para conocer
                más sobre nuestro trabajo.
              </p>
            </div>

            <div className="space-y-6">
              {/* Email */}
              <a
                href={`mailto:${siteConfig.email}`}
                className="flex items-center gap-4 group"
              >
                <div className="w-12 h-12 bg-card border border-border rounded-xl flex items-center justify-center group-hover:border-accent/40 transition-colors">
                  <Icon icon="tabler:mail" className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium">Correo</p>
                  <p className="text-muted text-sm">{siteConfig.email}</p>
                </div>
              </a>

              {/* LinkedIn */}
              <a
                href={siteConfig.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 group"
              >
                <div className="w-12 h-12 bg-card border border-border rounded-xl flex items-center justify-center group-hover:border-accent/40 transition-colors">
                  <Icon icon="simple-icons:linkedin" className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium">LinkedIn</p>
                  <p className="text-muted text-sm">{siteConfig.name}</p>
                </div>
              </a>

              {/* GitHub */}
              <a
                href={siteConfig.social.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 group"
              >
                <div className="w-12 h-12 bg-card border border-border rounded-xl flex items-center justify-center group-hover:border-accent/40 transition-colors">
                  <Icon icon="simple-icons:github" className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium">GitHub</p>
                  <p className="text-muted text-sm">devnation593</p>
                </div>
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
