import type { StageKey } from "@/lib/focus-logic";

/** Planta de Focus Garden — una sola especie («brote común») en cinco etapas.
 *  Trazo lineal botánico, color heredado (currentColor): funciona en claro y
 *  oscuro sin hex propios. Sin animaciones permanentes; el cambio de etapa
 *  usa una transición de opacidad breve que prefers-reduced-motion anula
 *  (regla global en globals.css). */

function Semilla() {
  return (
    <>
      <ellipse cx="48" cy="70" rx="7" ry="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M48 65.5c.5-3 2-5 4.5-6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
      <path d="M26 78h44" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20 82h10M66 82h10" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
    </>
  );
}

function Brote() {
  return (
    <>
      <path d="M48 78V58" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M48 63c-5-.8-8-3.6-9-8.6 5 .8 8 3.6 9 8.6Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M48 60c1-4.8 4-7.6 8.8-8.5-1 4.8-4 7.6-8.8 8.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M26 78h44" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20 82h10M66 82h10" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
    </>
  );
}

function Hojas() {
  return (
    <>
      <path d="M48 78c0-14-.5-24 .8-36" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M47.8 68c-7-1.2-11-4.9-12.3-11.9 7 1.2 11 4.9 12.3 11.9Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M48.2 61c1.3-6.7 5.1-10.3 11.8-11.5-1.3 6.7-5.1 10.3-11.8 11.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M48 52c-5.4-.9-8.6-3.8-9.7-9.3 5.4.9 8.6 3.8 9.7 9.3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M48.6 45.5c1-5.2 4-8 9.2-9-1 5.2-4 8-9.2 9Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M26 78h44" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20 82h10M66 82h10" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
    </>
  );
}

function PlantaJoven() {
  return (
    <>
      <path d="M48 78c0-18-1-30 1-46" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M47.6 70C38.6 68.5 33.5 63.8 32 54.8c9 1.5 14.1 6.2 15.6 15.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M48.3 61c1.8-8.7 6.7-13.3 15.4-14.8-1.8 8.7-6.7 13.3-15.4 14.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M47.8 51.5c-6.5-1.1-10.3-4.5-11.5-11 6.5 1.1 10.3 4.5 11.5 11Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M48.8 44c1.2-6 4.7-9.4 10.8-10.5-1.2 6-4.7 9.4-10.8 10.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M48.5 35.5c-4.6-.8-7.2-3.2-8.1-7.9 4.6.8 7.2 3.2 8.1 7.9Z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
      <path d="M34 62c4.5 1.2 8.5 4 11.5 8.8" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.5" />
      <path d="M26 78h44" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20 82h10M66 82h10" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
    </>
  );
}

function PlantaCompleta() {
  return (
    <>
      <path d="M48 78c0-22-1.2-38 1.2-58" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M47.5 72C37.5 70.3 31.8 65 30 55c10 1.7 15.7 7 17.5 17Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M48.4 63c2-9.7 7.5-14.9 17.2-16.6-2 9.7-7.5 14.9-17.2 16.6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M47.7 53c-7.4-1.3-11.7-5.1-13-12.5 7.4 1.3 11.7 5.1 13 12.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M48.9 45c1.4-6.9 5.4-10.8 12.4-12-1.4 6.9-5.4 10.8-12.4 12Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M48.3 36.5c-5.5-1-8.7-3.9-9.8-9.5 5.5 1 8.7 3.9 9.8 9.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M49.2 29.5c1.1-5.5 4.3-8.6 9.8-9.6-1.1 5.5-4.3 8.6-9.8 9.6Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M48.8 21.5c-3.9-.7-6.1-2.8-6.9-6.7 3.9.7 6.1 2.8 6.9 6.7Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M32 62.5c5.5 1.4 10.3 4.8 13.8 10.4M64 49c-5.5 1.7-10 5.3-13.2 11.3" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.5" />
      <path d="M26 78h44" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20 82h10M66 82h10" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
    </>
  );
}

const STAGE_ART: Record<StageKey, () => React.ReactNode> = {
  semilla: Semilla,
  brote: Brote,
  hojas: Hojas,
  "planta-joven": PlantaJoven,
  "planta-completa": PlantaCompleta,
};

/** Encuadre por etapa: las etapas tempranas ocupan solo la base del dibujo,
 *  así que se acercan (escala alrededor de su centro) para que la planta sea
 *  protagonista a cualquier tamaño. El crecimiento «aleja la cámara». */
const STAGE_VIEW: Record<StageKey, { k: number; cx: number; cy: number }> = {
  semilla: { k: 1.8, cx: 48, cy: 72 },
  brote: { k: 1.6, cx: 48, cy: 67 },
  hojas: { k: 1.25, cx: 48, cy: 59 },
  "planta-joven": { k: 1.08, cx: 48, cy: 52 },
  "planta-completa": { k: 1, cx: 48, cy: 48 },
};

export function FocusPlant({ stage, className }: { stage: StageKey; className?: string }) {
  const Art = STAGE_ART[stage] ?? Semilla;
  const v = STAGE_VIEW[stage] ?? STAGE_VIEW.semilla;
  const tx = 48 - v.cx * v.k;
  const ty = 46 - v.cy * v.k;
  return (
    <svg viewBox="0 0 96 88" fill="none" className={className} aria-hidden="true" data-stage={stage}>
      {/* key fuerza el remount al cambiar de etapa → transición de opacidad breve */}
      <g key={stage} className="transition-opacity duration-500 starting:opacity-0" transform={`translate(${tx} ${ty}) scale(${v.k})`}>
        <Art />
      </g>
    </svg>
  );
}
