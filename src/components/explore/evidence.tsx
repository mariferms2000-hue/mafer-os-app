import { FlaskConical, AlertTriangle, Landmark, HelpCircle, Heart } from "lucide-react";

/** Clasificación de evidencia — clave para temas de salud, biotipos, homeopatía, etc.
 *  Nunca presenta marcos tradicionales o hipótesis como hechos científicos. */
export const EVIDENCE: Record<
  string,
  { label: string; hint: string; chip: string; icon: typeof FlaskConical }
> = {
  "evidencia-solida": {
    label: "Evidencia sólida",
    hint: "Respaldado por investigación científica consistente.",
    chip: "chip-done",
    icon: FlaskConical,
  },
  "evidencia-limitada": {
    label: "Evidencia limitada",
    hint: "Hay estudios, pero pocos o con limitaciones. Leer con criterio.",
    chip: "chip-waiting",
    icon: AlertTriangle,
  },
  "marco-tradicional": {
    label: "Marco tradicional",
    hint: "Sistema tradicional o cultural. No equivale a evidencia científica.",
    chip: "chip",
    icon: Landmark,
  },
  hipotesis: {
    label: "Hipótesis",
    hint: "Una idea por comprobar. Trátala como pregunta, no como respuesta.",
    chip: "chip",
    icon: HelpCircle,
  },
  "reflexion-personal": {
    label: "Reflexión personal",
    hint: "Tu experiencia y observaciones. Valiosas, pero personales.",
    chip: "chip-sage",
    icon: Heart,
  },
};

export function EvidenceChip({ value }: { value: string | null }) {
  const e = EVIDENCE[value ?? ""];
  if (!e) return null;
  const Icon = e.icon;
  return (
    <span className={`chip ${e.chip}`} title={e.hint}>
      <Icon size={11} aria-hidden /> {e.label}
    </span>
  );
}
