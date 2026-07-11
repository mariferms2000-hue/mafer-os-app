"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";

/**
 * Recomendador transparente basado en reglas (sin IA dentro de la app).
 * Cada regla: palabras clave → recomendaciones. Editable aquí mismo.
 */
type Rule = {
  keywords: string[];
  title: string;
  steps: { tool: string; why: string }[];
  warning?: string;
};

const RULES: Rule[] = [
  {
    keywords: ["carrusel", "instagram", "post", "reel", "contenido", "publicar", "caption"],
    title: "Contenido para redes (MACA u otro)",
    steps: [
      { tool: "Claude Code → /maca-crear-contenido", why: "Pipeline completo si es de MACA: investiga, planea, redacta y audita." },
      { tool: "Claude Code → /maca-producir", why: "Convierte la pieza aprobada en especificaciones para diseño." },
      { tool: "Canva", why: "El diseño final editable que vas a publicar." },
    ],
    warning: "Nunca publiques contenido MACA sin pasar por /maca-auditar.",
  },
  {
    keywords: ["decidir", "decisión", "precio", "estrategia", "negocio", "socio", "hospital", "propuesta"],
    title: "Decisión de negocio",
    steps: [
      { tool: "Claude Code → agente maca-senior-consultant", why: "Conoce el contexto de MACA y desafía ideas débiles (si es de MACA)." },
      { tool: "ChatGPT o Claude Chat", why: "Para pensar en voz alta si es un tema general." },
      { tool: "Mafer OS → Decisiones", why: "Registra lo decidido con su porqué." },
    ],
  },
  {
    keywords: ["web", "seo", "framer", "página", "sitio", "google", "buscador"],
    title: "Sitio web y SEO",
    steps: [
      { tool: "Claude Code → agente maca-web-framer-seo-assistant", why: "Especialista en el sitio de MACA, SEO y visibilidad en IA." },
    ],
  },
  {
    keywords: ["foto", "video", "imagen", "asset", "material", "visual"],
    title: "Material visual",
    steps: [
      { tool: "Claude Code → /maca-curar-assets", why: "Evalúa riesgo, privacidad y usos seguros de fotos/videos reales." },
      { tool: "Generador de imágenes", why: "Solo para ilustraciones conceptuales, nunca «pacientes» falsos." },
    ],
  },
  {
    keywords: ["contrato", "legal", "política", "privacidad", "consentimiento", "términos", "cancelación"],
    title: "Lenguaje legal o políticas",
    steps: [
      { tool: "Claude Code → agente maca-legal-policy-assistant", why: "Guía conservadora de riesgo (no sustituye a un abogado)." },
    ],
    warning: "Para decisiones legales reales, confirma con un abogado humano.",
  },
  {
    keywords: ["aprender", "curso", "estudiar", "entender", "investigar", "tema"],
    title: "Aprender un tema",
    steps: [
      { tool: "Mafer OS → Learn Fast", why: "Crea el espacio: define para qué y qué es «suficientemente bueno»." },
      { tool: "ChatGPT o Claude Chat", why: "Pídele un plan de estudio y explicaciones a tu nivel." },
    ],
  },
  {
    keywords: ["archivo", "carpeta", "organizar", "vault", "obsidian", "automatizar", "app", "script", "código"],
    title: "Trabajo sobre tus archivos o automatización",
    steps: [
      { tool: "Claude Code", why: "Es el único que puede crear/editar archivos en tu Mac y automatizar." },
    ],
  },
  {
    keywords: ["prompt", "mejorar prompt", "instrucciones"],
    title: "Crear o mejorar un prompt",
    steps: [
      { tool: "Claude Code → agente prompt-architect", why: "Convierte ideas sueltas en prompts precisos." },
      { tool: "Mafer OS → Prompts", why: "Guárdalo en tu biblioteca con versión y notas." },
    ],
  },
];

const FALLBACK: Rule = {
  keywords: [],
  title: "Sugerencia general",
  steps: [
    { tool: "ChatGPT o Claude Chat", why: "Empieza conversando: describe qué quieres lograr." },
    { tool: "Claude Code", why: "Si termina en archivos, automatización o algo de MACA, pásalo aquí." },
  ],
  warning: "Si me cuentas con otras palabras (ej. «carrusel», «decisión», «aprender»), puedo afinar la recomendación.",
};

export function Recommender() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<Rule[] | null>(null);

  function recommend() {
    const text = q.toLowerCase();
    const hits = RULES.filter((r) => r.keywords.some((k) => text.includes(k)));
    setResult(hits.length ? hits : [FALLBACK]);
  }

  return (
    <section className="card p-5" aria-labelledby="recomendador">
      <h2 id="recomendador" className="text-lg text-forest-deep flex items-center gap-2 mb-1">
        <Wand2 size={18} className="text-olive" aria-hidden /> ¿Qué herramienta uso?
      </h2>
      <p className="text-sm text-stone mb-3">
        Describe lo que necesitas hacer y te sugiero el camino. Son reglas transparentes, no magia.
      </p>
      <div className="flex flex-col md:flex-row gap-2">
        <label className="sr-only" htmlFor="rec-input">Describe tu necesidad</label>
        <input
          id="rec-input"
          className="input flex-1"
          placeholder="Ej.: necesito diseñar un carrusel para MACA"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && recommend()}
          data-testid="recommender-input"
        />
        <button type="button" className="btn btn-primary" onClick={recommend} data-testid="recommender-go">
          Recomiéndame
        </button>
      </div>
      {result && (
        <div className="mt-4 flex flex-col gap-4" data-testid="recommender-result">
          {result.map((r) => (
            <div key={r.title} className="rounded-xl bg-beige/70 border border-sand p-4">
              <p className="text-sm font-semibold text-ink-green mb-2">{r.title}</p>
              <ol className="flex flex-col gap-2">
                {r.steps.map((s, i) => (
                  <li key={i} className="text-sm flex gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-soft text-forest text-xs font-semibold">
                      {i + 1}
                    </span>
                    <span>
                      <strong>{s.tool}</strong> — <span className="text-stone">{s.why}</span>
                    </span>
                  </li>
                ))}
              </ol>
              {r.warning && <p className="text-xs text-waiting mt-2.5">⚠ {r.warning}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
