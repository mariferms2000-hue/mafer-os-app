import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorarTabs } from "@/components/explore/tabs";
import { STAGES, type StageKey } from "@/lib/focus-logic";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catálogo de especies" };

/* Catálogo de especies — Fase 4B, piloto de assets ilustrados.
   Vista de revisión LIMPIA: únicamente los assets derivados directamente de
   la referencia visual real (botanical-reference-01.png), sin arte SVG
   rechazado ni comparaciones mezcladas. No depende de plantas guardadas ni
   crea datos: solo imágenes estáticas de public/plants/.

   La escala relativa entre etapas se conserva tal cual la lámina de
   referencia (lienzo uniforme por especie): la semilla se ve pequeña junto
   a la planta completa, igual que en la referencia. La variante clara u
   oscura se elige según el tema activo (clases stage-light/stage-dark). */

const PILOT_SPECIES = [
  { key: "monstera", label: "Monstera" },
  { key: "lavanda", label: "Lavanda" },
  { key: "cactus", label: "Cactus" },
] as const;

const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<
  StageKey,
  string
>;

/** Dimensiones intrínsecas por especie (lienzo uniforme por fila de la
 *  referencia; small = 320 px de lado mayor). */
const DIMS: Record<string, { large: [number, number]; small: [number, number] }> = {
  monstera: { large: [411, 318], small: [320, 248] },
  lavanda: { large: [411, 324], small: [320, 252] },
  cactus: { large: [411, 340], small: [320, 265] },
};

function StageAsset({ species, stage, size }: { species: string; stage: StageKey; size: "small" | "large" }) {
  const [w, h] = DIMS[species][size];
  return (
    <>
      <Image
        src={`/plants/${species}-${stage}-light-${size}.webp`}
        width={w}
        height={h}
        alt=""
        aria-hidden
        unoptimized
        loading="eager"
        className="stage-light max-h-full max-w-full object-contain"
      />
      <Image
        src={`/plants/${species}-${stage}-dark-${size}.webp`}
        width={w}
        height={h}
        alt=""
        aria-hidden
        unoptimized
        loading="eager"
        className="stage-dark max-h-full max-w-full object-contain"
      />
    </>
  );
}

function SpeciesRow({
  species,
  label,
  size,
  boxClass,
}: {
  species: string;
  label: string;
  size: "small" | "large";
  boxClass: string;
}) {
  return (
    <div className="card p-4 md:p-5" data-testid={`especies-${size}-${species}`}>
      <p className="font-display text-lg text-forest-deep mb-3">{label}</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 md:gap-4 items-end">
        {STAGES.map((s) => (
          <div key={s.key} className="flex flex-col items-center gap-1.5">
            <div className={`${boxClass} flex items-end justify-center`}>
              <StageAsset species={species} stage={s.key} size={size} />
            </div>
            <span className="text-[11px] text-stone text-center">{STAGE_LABEL[s.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EspeciesPage() {
  return (
    <div>
      <PageHeader
        title="Catálogo de especies"
        intro="Piloto de assets ilustrados — Monstera, Lavanda y Cactus en sus 5 etapas, derivados directamente de la referencia botánica. La escala entre etapas es la real de la lámina."
      >
        <Link href="/explorar/jardin" className="btn btn-ghost" data-testid="especies-back">
          <ArrowLeft size={15} aria-hidden /> Volver a Mi jardín
        </Link>
      </PageHeader>
      <ExplorarTabs />

      <style>{`
        .stage-light { display: block; }
        .stage-dark { display: none; }
        html[data-theme="dark"] .stage-light { display: none; }
        html[data-theme="dark"] .stage-dark { display: block; }
      `}</style>

      <section aria-labelledby="especies-chico" className="mt-8">
        <h2 id="especies-chico" className="section-eyebrow mb-3">
          Tamaño chico — como en Mi jardín (h-32)
        </h2>
        <div className="flex flex-col gap-4">
          {PILOT_SPECIES.map((sp) => (
            <SpeciesRow key={sp.key} species={sp.key} label={sp.label} size="small" boxClass="h-32 w-32" />
          ))}
        </div>
      </section>

      <section aria-labelledby="especies-grande" className="mt-10">
        <h2 id="especies-grande" className="section-eyebrow mb-3">
          Tamaño grande — como en el popup (h-44)
        </h2>
        <div className="flex flex-col gap-4">
          {PILOT_SPECIES.map((sp) => (
            <SpeciesRow key={sp.key} species={sp.key} label={sp.label} size="large" boxClass="h-44 w-44" />
          ))}
        </div>
      </section>
    </div>
  );
}
