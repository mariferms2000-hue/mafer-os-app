import Link from "next/link";
import { count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { ArrowRight, FolderOpen, LibraryBig, Lightbulb, NotebookPen, ScrollText, Sprout, type LucideIcon } from "lucide-react";
import { db, schema } from "@/lib/db";
import { today } from "@/lib/tz";
import { PLANT_COMPLETE_MINUTES } from "@/lib/focus-logic";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Biblioteca" };

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «hoy», «ayer», «hace 4 días» o «12 sep». */
function cuando(ymd: string, hoy: string): string {
  const dias = Math.round((Date.parse(hoy) - Date.parse(ymd)) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

type Space = { href: string; title: string; hint: string; icon: LucideIcon; stat: string; testid: string };

/** Portada de la Biblioteca: un espacio por tarjeta. Sustituye a Explorar y a
 *  «Mi sistema de IA» (Bloque 2). Las tarjetas SON la navegación: dentro de
 *  cada espacio solo hay un enlace de vuelta, y pestañas únicamente en Ideas. */
export default async function BibliotecaPage() {
  const hoy = today();
  const [
    [ideas],
    [learning],
    [journal],
    [lastJournal],
    [prompts],
    [favPrompts],
    [pendientes],
    [recursos],
    [plantas],
    [actual],
  ] = await Promise.all([
    db.select({ n: count() }).from(schema.ideas).where(inArray(schema.ideas.status, ["incubando", "algun-dia"])),
    db.select({ n: count() }).from(schema.learningTopics).where(eq(schema.learningTopics.status, "activo")),
    db.select({ n: count() }).from(schema.journalEntries),
    db.select({ date: schema.journalEntries.date }).from(schema.journalEntries).orderBy(desc(schema.journalEntries.date)).limit(1),
    db.select({ n: count() }).from(schema.prompts),
    db.select({ n: count() }).from(schema.prompts).where(eq(schema.prompts.favorite, true)),
    db.select({ n: count() }).from(schema.resources).where(eq(schema.resources.status, "pendiente")),
    db.select({ n: count() }).from(schema.resources),
    db.select({ n: count() }).from(schema.focusPlants).where(isNotNull(schema.focusPlants.completedAt)),
    db
      .select({ minutes: schema.focusPlants.accumulatedMinutes })
      .from(schema.focusPlants)
      .where(isNull(schema.focusPlants.completedAt))
      .limit(1),
  ]);

  const spaces: Space[] = [
    {
      href: "/biblioteca/ideas",
      title: "Ideas",
      hint: "Incubadora y Learn Fast: lo que podría ser y lo que quieres aprender.",
      icon: Lightbulb,
      stat: `${plural(ideas.n, "idea incubando", "ideas incubando")} · ${plural(learning.n, "tema activo", "temas activos")}`,
      testid: "space-ideas",
    },
    {
      href: "/biblioteca/journal",
      title: "Journal",
      hint: "Tu espacio para pensar por escrito.",
      icon: NotebookPen,
      stat: lastJournal ? `${plural(journal.n, "entrada", "entradas")} · la última ${cuando(lastJournal.date, hoy)}` : "Sin entradas todavía",
      testid: "space-journal",
    },
    {
      href: "/biblioteca/prompts",
      title: "Prompts",
      hint: "Tus prompts maestros, listos para copiar y reutilizar.",
      icon: ScrollText,
      stat: `${plural(prompts.n, "prompt", "prompts")}${favPrompts.n ? ` · ${favPrompts.n} ★` : ""}`,
      testid: "space-prompts",
    },
    {
      href: "/biblioteca/recursos",
      title: "Recursos",
      hint: "Videos, artículos y materiales que quieres conservar.",
      icon: FolderOpen,
      stat: recursos.n ? `${plural(recursos.n, "recurso", "recursos")} · ${pendientes.n} por revisar` : "Sin recursos guardados",
      testid: "space-recursos",
    },
    {
      href: "/biblioteca/jardin",
      title: "Mi jardín",
      hint: "Las plantas que crecieron con tu tiempo de enfoque.",
      icon: Sprout,
      stat: `${plural(plantas.n, "planta completa", "plantas completas")}${actual ? ` · la actual en ${actual.minutes} de ${PLANT_COMPLETE_MINUTES} min` : ""}`,
      testid: "space-jardin",
    },
  ];

  return (
    <div>
      <PageHeader
        icon={LibraryBig}
        title="Biblioteca"
        intro="Lo que guardas para pensar, aprender y volver: ideas, escritura, prompts, recursos y tu jardín."
      />
      {/* En el iPhone, filas compactas; desde tableta, tarjetas en rejilla. */}
      <ul className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="biblioteca-spaces">
        {spaces.map(({ href, title, hint, icon: Icon, stat, testid }) => (
          <li key={href}>
            <Link
              href={href}
              data-testid={testid}
              className="card p-4 sm:p-5 h-full flex flex-row sm:flex-col items-center sm:items-stretch gap-3 hover:shadow-lift transition-shadow group"
            >
              <span className="flex items-center justify-between shrink-0">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sage-soft text-forest">
                  <Icon size={19} aria-hidden />
                </span>
                <ArrowRight size={16} className="hidden sm:block text-stone-soft group-hover:text-forest transition-colors" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 sm:flex-none">
                <span className="block font-display text-lg sm:text-xl text-forest-deep">{title}</span>
                <span className="hidden sm:block text-sm text-stone mt-0.5">{hint}</span>
                <span className="block sm:hidden text-xs text-stone-soft mt-0.5">{stat}</span>
              </span>
              <span className="hidden sm:block mt-auto text-xs text-stone-soft">{stat}</span>
              <ArrowRight size={16} className="sm:hidden shrink-0 text-stone-soft" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
