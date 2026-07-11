import { asc } from "drizzle-orm";
import {
  LibraryBig,
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
  type LucideIcon,
} from "lucide-react";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { BibliotecaTabs } from "@/components/library/tabs";
import { Recommender } from "@/components/library/recommender";

export const dynamic = "force-dynamic";
export const metadata = { title: "Biblioteca" };

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

export default async function BibliotecaPage() {
  const tools = await db.select().from(schema.aiTools).orderBy(asc(schema.aiTools.position));

  return (
    <div>
      <PageHeader
        icon={LibraryBig}
        title="Qué IA usar"
        intro="Tu mapa personal de herramientas: cuál brilla para qué, cuándo evitarla y ejemplos de tu propio trabajo."
      />
      <BibliotecaTabs />

      <div className="mb-8">
        <Recommender />
      </div>

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
                  <h2 className="text-base font-body font-semibold">{t.name}</h2>
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
              <p className="text-sm"><strong className="text-ink-green">Qué obtienes:</strong> <span className="text-stone">{t.expectedOutput}</span></p>
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
    </div>
  );
}
