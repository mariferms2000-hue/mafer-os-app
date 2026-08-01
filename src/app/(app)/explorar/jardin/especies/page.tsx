import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorarTabs } from "@/components/explore/tabs";
import { PlantArt } from "@/components/focus/plant-art";
import { STAGES, type StageKey } from "@/lib/focus-logic";
import { SPECIES_LABEL } from "@/lib/plant-svg-v2";
import { ILLUSTRATED_SPECIES } from "@/lib/plant-illustration-fixed";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catálogo de especies" };

/* Catálogo de especies — Fase 4B, piloto de ilustración botánica fija.
   Vista de solo lectura, sin depender de plantas guardadas en la base: usa
   el motor real (PlantArt) con visualSeed fijo, así que lo que se ve aquí
   es EXACTAMENTE lo mismo que dibuja la app en Enfoque, Mi jardín y el
   popup — no una recreación aparte. Temporal mientras se revisa el piloto;
   solo muestra las especies ya migradas al motor fijo (monstera, lavanda,
   cactus). No crea ni lee ninguna planta real. */

const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<
  StageKey,
  string
>;

/** Asset del piloto de assets ilustrados (derivado directamente de
 *  botanical-reference-01.png): la variante clara u oscura se muestra según
 *  el tema activo de la app, vía las clases pilot-light/pilot-dark de abajo. */
function PilotAsset({ size, className }: { size: "small" | "large"; className?: string }) {
  const dims = size === "large" ? { w: 378, h: 301 } : { w: 320, h: 255 };
  return (
    <>
      <Image
        src={`/plants/monstera-completa-light-${size}.webp`}
        width={dims.w}
        height={dims.h}
        alt=""
        aria-hidden
        unoptimized
        priority
        className={`pilot-light object-contain ${className ?? ""}`}
      />
      <Image
        src={`/plants/monstera-completa-dark-${size}.webp`}
        width={dims.w}
        height={dims.h}
        alt=""
        aria-hidden
        unoptimized
        priority
        className={`pilot-dark object-contain ${className ?? ""}`}
      />
    </>
  );
}

export default function EspeciesPage() {
  return (
    <div>
      <PageHeader
        title="Catálogo de especies"
        intro="Piloto de ilustración botánica — cada especie en sus 5 etapas, con el motor real que usa la app. Vista temporal de solo lectura, no depende de tus plantas guardadas."
      >
        <Link href="/explorar/jardin" className="btn btn-ghost" data-testid="especies-back">
          <ArrowLeft size={15} aria-hidden /> Volver a Mi jardín
        </Link>
      </PageHeader>
      <ExplorarTabs />

      {/* ── COMPARACIÓN TEMPORAL DEL PILOTO (solo para revisión en Preview,
             no es interfaz final): assets ilustrados de Monstera derivados
             directamente de botanical-reference-01.png. La variante clara u
             oscura se elige según el tema activo de la app. ── */}
      <style>{`
        .pilot-light { display: block; }
        .pilot-dark { display: none; }
        html[data-theme="dark"] .pilot-light { display: none; }
        html[data-theme="dark"] .pilot-dark { display: block; }
      `}</style>
      <section aria-labelledby="piloto-monstera" className="mt-8" data-testid="piloto-monstera">
        <h2 id="piloto-monstera" className="section-eyebrow mb-3">
          Piloto — Monstera · planta completa (comparación temporal, solo Preview)
        </h2>

        <div className="card p-4 md:p-5 mb-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col items-center gap-1.5">
              <Image
                src="/plants/monstera-completa-referencia.webp"
                width={378}
                height={301}
                alt=""
                aria-hidden
                unoptimized
        priority
                className="w-full max-w-[220px] rounded-lg border border-card-border"
              />
              <span className="text-[11px] text-stone text-center">Referencia original (recorte)</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-full max-w-[220px] flex items-center justify-center">
                <PilotAsset size="large" className="w-full" />
              </div>
              <span className="text-[11px] text-stone text-center">Asset preparado (según tu tema)</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-full max-w-[220px] rounded-lg border p-3 flex items-center justify-center"
                style={{ background: "#fffefb", borderColor: "#e5ddcb" }}
              >
                <Image
                  src="/plants/monstera-completa-light-large.webp"
                  width={378}
                  height={301}
                  alt=""
                  aria-hidden
                  unoptimized
        priority
                  className="w-full object-contain"
                />
              </div>
              <span className="text-[11px] text-stone text-center">Variante clara (fondo claro forzado)</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-full max-w-[220px] rounded-lg border p-3 flex items-center justify-center"
                style={{ background: "#151a13", borderColor: "#232a1f" }}
              >
                <Image
                  src="/plants/monstera-completa-dark-large.webp"
                  width={378}
                  height={301}
                  alt=""
                  aria-hidden
                  unoptimized
        priority
                  className="w-full object-contain"
                />
              </div>
              <span className="text-[11px] text-stone text-center">Variante oscura (fondo oscuro forzado)</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Tamaño real: tarjeta principal de Mi jardín (h-40 / md:h-48) */}
          <div className="card p-5 flex flex-col sm:flex-row items-center gap-5">
            <div className="h-40 w-40 md:h-48 md:w-48 shrink-0 flex items-center justify-center">
              <PilotAsset size="large" className="max-h-full max-w-full" />
            </div>
            <div className="min-w-0 text-center sm:text-left">
              <p className="section-eyebrow">Planta actual</p>
              <p className="font-display text-2xl text-forest-deep mt-1">Monstera</p>
              <p className="text-sm text-stone mt-0.5">Planta completa</p>
              <p className="text-[11px] text-stone-soft mt-2">Tamaño real de Mi jardín</p>
            </div>
          </div>
          {/* Tamaño real: tarjeta del grid de completadas (h-32, asset small) */}
          <div className="card p-4 flex flex-col items-center text-center justify-center">
            <div className="h-32 w-32 flex items-center justify-center">
              <PilotAsset size="small" className="max-h-full max-w-full" />
            </div>
            <p className="font-display text-lg text-forest-deep mt-2">Monstera</p>
            <p className="text-[11px] text-stone-soft">Tamaño real del grid (asset small)</p>
          </div>
          {/* Tamaño real: popup de detalle (h-44) */}
          <div className="card card-raised p-6 flex flex-col items-center text-center justify-center">
            <p className="section-eyebrow self-start">Planta completada</p>
            <div className="h-44 w-44 flex items-center justify-center">
              <PilotAsset size="large" className="max-h-full max-w-full" />
            </div>
            <p className="font-display text-2xl text-forest-deep mt-1">Monstera</p>
            <p className="text-[11px] text-stone-soft mt-1">Tamaño real del popup</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="especies-chico" className="mt-8">
        <h2 id="especies-chico" className="section-eyebrow mb-3">
          Tamaño chico — como en Enfoque / Mi jardín
        </h2>
        <div className="flex flex-col gap-4">
          {ILLUSTRATED_SPECIES.map((species) => (
            <div key={species} className="card p-4 md:p-5" data-testid={`especies-row-chico-${species}`}>
              <p className="font-display text-lg text-forest-deep mb-3">{SPECIES_LABEL[species] ?? species}</p>
              <div className="grid grid-cols-5 gap-2 md:gap-4">
                {STAGES.map((s) => (
                  <div key={s.key} className="flex flex-col items-center gap-1.5">
                    <PlantArt species={species} visualSeed={0} stage={s.key} className="h-16 w-16 md:h-20 md:w-20 text-sage-deep" />
                    <span className="text-[11px] text-stone text-center">{STAGE_LABEL[s.key]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="especies-grande" className="mt-10">
        <h2 id="especies-grande" className="section-eyebrow mb-3">
          Tamaño grande — como en el popup
        </h2>
        <div className="flex flex-col gap-4">
          {ILLUSTRATED_SPECIES.map((species) => (
            <div key={species} className="card p-4 md:p-5" data-testid={`especies-row-grande-${species}`}>
              <p className="font-display text-lg text-forest-deep mb-3">{SPECIES_LABEL[species] ?? species}</p>
              <div className="grid grid-cols-5 gap-2 md:gap-4">
                {STAGES.map((s) => (
                  <div key={s.key} className="flex flex-col items-center gap-1.5">
                    <PlantArt species={species} visualSeed={0} stage={s.key} className="h-28 w-28 md:h-36 md:w-36 text-sage-deep" />
                    <span className="text-[11px] text-stone text-center">{STAGE_LABEL[s.key]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
