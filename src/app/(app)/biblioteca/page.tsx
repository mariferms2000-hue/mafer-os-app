import Link from "next/link";
import { asc } from "drizzle-orm";
import {
  Wand2,
  MessageCircle,
  FolderOpen,
  MessagesSquare,
  Terminal,
  Sparkles,
  Globe,
  Palette,
  Image as ImageIcon,
  Bot,
  Wrench,
  SquareChevronRight,
  FileCheck,
  Code,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { BibliotecaTabs } from "@/components/library/tabs";
import { Recommender } from "@/components/library/recommender";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi sistema de IA" };

const TOOL_ICONS: Record<string, LucideIcon> = {
  "message-circle": MessageCircle,
  "folder-open": FolderOpen,
  "messages-square": MessagesSquare,
  terminal: Terminal,
  sparkles: Sparkles,
  globe: Globe,
  palette: Palette,
  image: ImageIcon,
  bot: Bot,
  wrench: Wrench,
  "square-chevron-right": SquareChevronRight,
};

const COMPLEXITY_LABEL: Record<string, string> = {
  baja: "Fácil de usar",
  media: "Requiere práctica",
  alta: "Terreno técnico",
};

/** Flujos reales de Mafer — pasos concretos con comandos y agentes verdaderos. */
const FLUJOS = [
  {
    title: "Crear contenido para MACA",
    context: "De la idea al diseño publicable, con auditoría obligatoria.",
    steps: [
      { what: "Anota la idea", how: "Mafer OS → botón + → captura (o directo al paso 2)" },
      { what: "Pipeline completo", how: "Claude Code → /maca-crear-contenido «tu idea»", detail: "Ejecuta investigador → estratega → escritor → auditor en secuencia." },
      { what: "Revisa el veredicto", how: "Approved / Revise / Blocked — nunca publiques sin Approved" },
      { what: "Paquete de producción", how: "/maca-producir con la pieza aprobada" },
      { what: "Preview local (opcional)", how: "/maca-render-preview para ver la composición antes de diseñar" },
      { what: "Diseño final", how: "Canva, siguiendo las especificaciones del paquete" },
    ],
    error: "Error común: saltarse /maca-auditar «porque el texto ya se ve bien». Nunca.",
    link: { label: "Ver agentes MACA", href: "/biblioteca/agentes" },
  },
  {
    title: "Modificar Mafer OS",
    context: "Cambiar esta app con seguridad, sin romper nada.",
    steps: [
      { what: "Respaldo primero", how: "Terminal → cd ~/Desktop/\"Mafer OS\"/mafer-os-app && npm run backup" },
      { what: "Abre Claude Code ahí mismo", how: "claude (en esa carpeta)" },
      { what: "Pide el cambio en español", how: "Concreto: qué pantalla, qué comportamiento, qué esperas ver" },
      { what: "Exige prueba", how: "«Pruébalo y muéstrame que funciona antes de terminar»" },
      { what: "Commit al final", how: "«Haz commit del cambio» — así siempre puedes volver atrás" },
    ],
    error: "Error común: pedir tres cambios a la vez. Uno, probar, siguiente.",
    link: { label: "Manual completo", href: "/ajustes" },
  },
  {
    title: "Exploración visual",
    context: "Buscar dirección visual antes de invertir tiempo en diseño final.",
    steps: [
      { what: "Prepara un brief corto", how: "Qué es, para quién, sensación deseada, 2-3 referencias" },
      { what: "Explora", how: "Manus para exploración autónoma, o generador de imágenes para conceptos" },
      { what: "Filtra con criterio MACA", how: "Si es material real: /maca-curar-assets antes de usar" },
      { what: "Aterriza", how: "Canva para la versión editable final" },
    ],
    error: "Error común: usar imágenes generadas que parecen pacientes o clínicas reales — riesgo reputacional.",
    link: { label: "Prompts maestros", href: "/biblioteca/prompts" },
  },
];

export default async function BibliotecaPage() {
  const tools = await db.select().from(schema.aiTools).orderBy(asc(schema.aiTools.position));

  return (
    <div>
      <PageHeader
        icon={Wand2}
        title="Mi sistema de IA"
        intro="Tus flujos reales, con tus agentes, comandos y herramientas de verdad — no definiciones genéricas."
      />
      <BibliotecaTabs />

      <h2 className="text-lg text-forest-deep mb-3">Tus flujos</h2>
      <div className="grid gap-4 lg:grid-cols-3 mb-8">
        {FLUJOS.map((f) => (
          <section key={f.title} className="card p-5 flex flex-col" data-testid="flow-card">
            <h3 className="text-base font-body font-semibold">{f.title}</h3>
            <p className="text-xs text-stone mb-3">{f.context}</p>
            <ol className="flex flex-col gap-2.5 flex-1">
              {f.steps.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-soft text-forest text-xs font-semibold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium">{s.what}</span>
                    <code className="block text-xs text-ink-green bg-beige/70 rounded px-1.5 py-0.5 mt-0.5 whitespace-pre-wrap break-words">{s.how}</code>
                    {"detail" in s && s.detail && <span className="block text-xs text-stone mt-0.5">{s.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-waiting mt-3">⚠ {f.error}</p>
            <Link href={f.link.href} className="text-xs text-forest underline underline-offset-4 mt-2 hover:text-forest-deep">
              {f.link.label} →
            </Link>
          </section>
        ))}
      </div>

      <div className="mb-8">
        <Recommender />
      </div>

      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer list-none text-lg text-forest-deep font-display mb-3">
          Referencia de herramientas
          <ChevronDown size={16} className="text-stone transition-transform group-open:rotate-180" aria-hidden />
          <span className="text-xs font-body text-stone-soft font-normal">(cuál brilla para qué)</span>
        </summary>
        <ul className="grid gap-4 md:grid-cols-2">
          {tools.map((t) => {
            const Icon = TOOL_ICONS[t.icon ?? "sparkles"] ?? Sparkles;
            return (
              <li key={t.id} className="card p-5 flex flex-col gap-2.5" data-testid={`tool-${t.id}`}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sage-soft text-forest shrink-0">
                    <Icon size={19} aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-base font-body font-semibold">{t.name}</h3>
                    <p className="text-xs text-stone">{COMPLEXITY_LABEL[t.complexity ?? "baja"]}</p>
                  </div>
                  <div className="ml-auto flex gap-1">
                    {t.needsFiles ? <span className="chip" title="Suele necesitar archivos"><FileCheck size={11} aria-hidden /> archivos</span> : null}
                    {t.involvesCode ? <span className="chip" title="Involucra código o terminal"><Code size={11} aria-hidden /> código</span> : null}
                  </div>
                </div>
                <p className="text-sm"><strong className="text-ink-green">Brilla para:</strong> <span className="text-stone">{t.bestFor}</span></p>
                <p className="text-sm"><strong className="text-ink-green">Úsala cuando:</strong> <span className="text-stone">{t.whenToUse}</span></p>
                <p className="text-sm"><strong className="text-ink-green">Evítala cuando:</strong> <span className="text-stone">{t.whenNotToUse}</span></p>
                {(t.examples ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(t.examples ?? []).map((e, i) => (
                      <span key={i} className="chip">{e}</span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}
