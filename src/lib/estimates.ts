/* Duración estimada y energía requerida de las tareas — Fase 2.
   Módulo puro (sin dependencias de servidor): lo usan componentes cliente,
   páginas de servidor, exportaciones y pruebas.

   Tokens internos:
   - duración: under_10 | ten_to_30 | thirty_to_60 | over_60 | null (sin estimar)
   - energía requerida: low | medium | high | null (sin estimar)
   La energía del DÍA de Mafer (página Hoy) es otra cosa: vive en settings
   como `energy:YYYY-MM-DD` con valores baja|media|alta y no se mezcla aquí. */

export const DURATIONS = ["under_10", "ten_to_30", "thirty_to_60", "over_60"] as const;
export type Duration = (typeof DURATIONS)[number];

export const ENERGIES = ["low", "medium", "high"] as const;
export type Energy = (typeof ENERGIES)[number];

/** Mapeo de migración desde los tokens antiguos (documentado):
 *  5m → under_10 · 15m → ten_to_30 · 30m → ten_to_30 (la vista «≤30 min» los incluía)
 *  60m → thirty_to_60 (una hora cae en el borde superior del rango 30–60)
 *  deep → over_60 (trabajo profundo = más de una hora)
 *  baja → low · media → medium · alta → high · vacío → sin estimar (null) */
export const LEGACY_DURATION: Record<string, Duration> = {
  "5m": "under_10",
  "15m": "ten_to_30",
  "30m": "ten_to_30",
  "60m": "thirty_to_60",
  deep: "over_60",
};
export const LEGACY_ENERGY: Record<string, Energy> = { baja: "low", media: "medium", alta: "high" };

/** Normaliza cualquier valor guardado (nuevo, antiguo o basura) a un token válido o null. */
export function normalizeDuration(v: string | null | undefined): Duration | null {
  if (!v) return null;
  if ((DURATIONS as readonly string[]).includes(v)) return v as Duration;
  return LEGACY_DURATION[v] ?? null;
}
export function normalizeEnergy(v: string | null | undefined): Energy | null {
  if (!v) return null;
  if ((ENERGIES as readonly string[]).includes(v)) return v as Energy;
  return LEGACY_ENERGY[v] ?? null;
}

export const DURATION_LABEL: Record<string, string> = {
  under_10: "Menos de 10 min",
  ten_to_30: "10–30 min",
  thirty_to_60: "30–60 min",
  over_60: "Más de 60 min",
};
/** Versión corta para chips compactos (tarjetas del tablero). */
export const DURATION_SHORT: Record<string, string> = {
  under_10: "<10′",
  ten_to_30: "10–30′",
  thirty_to_60: "30–60′",
  over_60: ">60′",
};
export const ENERGY_LABEL: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta" };

export const durationLabel = (v: string | null | undefined): string | null => {
  const d = normalizeDuration(v);
  return d ? DURATION_LABEL[d] : null;
};
export const durationShort = (v: string | null | undefined): string | null => {
  const d = normalizeDuration(v);
  return d ? DURATION_SHORT[d] : null;
};
export const energyLabel = (v: string | null | undefined): string | null => {
  const e = normalizeEnergy(v);
  return e ? ENERGY_LABEL[e] : null;
};

/** La sección «Menos de 30 minutos» incluye exclusivamente estos rangos. */
export const QUICK_DURATIONS: readonly string[] = ["under_10", "ten_to_30"];

/* ── Sugerencias por reglas locales ──────────────────────────────────
   Transparentes y editables: la primera regla cuya palabra aparezca en el
   título gana. Son orientación, nunca se guardan sin confirmación. */

export type Suggestion = {
  duration: Duration;
  energy: Energy;
  /** La palabra del título que disparó la regla, para explicar el porqué. */
  matched: string;
};

type Rule = { words: string[]; duration: Duration; energy: Energy };

export const SUGGESTION_RULES: Rule[] = [
  // acciones rápidas y ligeras
  {
    words: ["enviar", "mandar", "confirmar", "descargar", "imprimir", "pagar", "avisar", "responder", "reenviar", "firmar", "reservar", "cancelar", "agendar", "recoger", "subir"],
    duration: "under_10",
    energy: "low",
  },
  // llamadas: cortas pero no instantáneas
  { words: ["llamar", "llamada", "telefonear"], duration: "ten_to_30", energy: "low" },
  // trabajo intermedio
  {
    words: ["revisar", "preparar", "comparar", "organizar", "actualizar", "leer", "resumir", "ordenar", "documentar", "cotizar", "elegir"],
    duration: "thirty_to_60",
    energy: "medium",
  },
  // trabajo profundo
  {
    words: ["investigar", "diseñar", "redactar", "desarrollar", "estrategia", "escribir", "estudiar", "analizar", "planear", "planificar", "crear", "construir", "programar", "migrar"],
    duration: "over_60",
    energy: "high",
  },
];

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Sugiere duración y energía a partir del título, o null si ninguna regla aplica. */
export function suggestEstimates(title: string): Suggestion | null {
  const texto = sinAcentos(title.toLowerCase());
  for (const rule of SUGGESTION_RULES) {
    for (const word of rule.words) {
      const w = sinAcentos(word.toLowerCase());
      // coincidencia por inicio de palabra: «llamar» también cubre «llamarle»
      const re = new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
      if (re.test(texto)) return { duration: rule.duration, energy: rule.energy, matched: word };
    }
  }
  return null;
}
