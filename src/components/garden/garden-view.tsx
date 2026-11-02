"use client";

/* Mi jardín (F4): el invernadero con la planta actual y la colección, y el
   cuidado de las plantas — regar con Agua y lucir una planta especial con
   Fertilizante.

   - Escritorio: una sola escena (A2 · Luz de invernadero) con la planta actual
     al centro y la ficha encima.
   - iPhone: la planta actual en su propia escena, la ficha debajo y, aparte,
     «Tu invernadero» con la colección (M3).
   - Tocar cualquier planta (escena o cuadrícula) abre su detalle con las
     acciones que correspondan. Cada acción se puede deshacer desde el aviso.

   Nada de esto toca minutos, etapas ni el Pomodoro. */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Droplet, Sparkles, Star, StarOff } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { GardenFocusButton } from "@/components/explore/garden-focus-button";
import { PlantDetailModal, type PlantDetailData } from "@/components/explore/plant-detail-modal";
import { PlantArt } from "@/components/focus/plant-art";
import { EmptyState } from "@/components/ui/empty-state";
import { STAGES, type StageKey } from "@/lib/focus-logic";
import { NO_CARE, careOptions, type PlantCare } from "@/lib/garden/care-logic";
import type { CareState } from "@/lib/garden/care";
import { DESKTOP_SCENE, PHONE_COLLECTION_SCENE, PHONE_HERO_SCENE, byScenePriority, placePlants } from "@/lib/garden/scene-layout";
import { LATIN, SPECIES_SCALE, asSpecies } from "@/lib/garden/species";
import { SPECIES_LABEL } from "@/lib/plant-svg-v2";
import type { PlantSpeciesV2 } from "@/lib/plant-render-v2";
import type { GardenData, GardenPlant } from "@/lib/queries/focus";
import { featurePlantAction, fertilizePlantAction, undoFertilizeAction, undoWaterAction, waterPlantAction } from "@/lib/actions/garden";
import { GardenFilters, GreenhouseScene, type PlacedWithCare, type SceneHero, type SceneMoment } from "./greenhouse";

const STAGE_LABEL = Object.fromEntries(STAGES.map((x) => [x.key, x.label])) as Record<StageKey, string>;
const MOMENT_MS = 1900;

function fecha(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

const nameOf = (species: string) => SPECIES_LABEL[species] ?? species;

/* Escritorio o iPhone. En el servidor (null) se pintan ambas escenas y el CSS
   decide; ya en el navegador queda solo la que corresponde, así ningún
   elemento interactivo existe dos veces. */
const DESKTOP_QUERY = "(min-width: 768px)";
function subscribeMedia(cb: () => void) {
  const m = window.matchMedia(DESKTOP_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
function useIsDesktop(): boolean | null {
  return useSyncExternalStore(
    subscribeMedia,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => null,
  );
}

export function GardenView({
  garden,
  extraPlants,
  greenhouse,
  shown,
  care: serverCare,
  rewards,
}: {
  garden: GardenData;
  /** la especial y las que tienen sed, aunque no estén entre las recientes */
  extraPlants: GardenPlant[];
  /** página actual de la cuadrícula del invernadero */
  greenhouse: GardenPlant[];
  shown: number;
  care: CareState;
  /** la sección de recompensas (servidor), entre la escena y la colección */
  rewards: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const isDesktop = useIsDesktop();
  const [openId, setOpenId] = useState<string | null>(null);
  const [moment, setMoment] = useState<SceneMoment>(null);
  const [pending, setPending] = useState(false);
  /** cambios ya hechos que el servidor aún no ha devuelto (para animar al instante) */
  const [overrides, setOverrides] = useState<Record<string, Partial<PlantCare>>>({});
  const [specialOverride, setSpecialOverride] = useState<{ id: string | null } | null>(null);

  // Cuando llega el estado nuevo del servidor, los cambios locales sobran.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOverrides({});
    setSpecialOverride(null);
  }, [serverCare]);

  useEffect(() => {
    if (!moment) return;
    const t = setTimeout(() => setMoment(null), MOMENT_MS);
    return () => clearTimeout(t);
  }, [moment]);

  const specialId = specialOverride ? specialOverride.id : serverCare.specialId;
  const careOf = useCallback(
    (id: string): PlantCare => {
      const base = serverCare.care[id] ?? NO_CARE;
      const o = overrides[id] ?? {};
      return { ...base, ...o, special: id === specialId };
    },
    [serverCare, overrides, specialId],
  );

  const current = garden.current;
  const all = useMemo(() => {
    const byId = new Map<string, GardenPlant>();
    for (const p of [...extraPlants, ...garden.completed]) if (!byId.has(p.id)) byId.set(p.id, p);
    return byId;
  }, [extraPlants, garden.completed]);

  // Orden de la escena: la especial, las que tienen sed y luego las más recientes.
  const scenePlants = useMemo(() => {
    const thirsty = new Set(Object.entries(serverCare.care).filter(([, c]) => c.thirsty).map(([id]) => id));
    const ordered = byScenePriority([...extraPlants, ...garden.completed.filter((p) => !extraPlants.some((x) => x.id === p.id))], serverCare.specialId, thirsty);
    return ordered.map((p) => ({ id: p.id, species: asSpecies(p.species), seed: p.visualSeed }));
  }, [extraPlants, garden.completed, serverCare]);

  const withCare = useCallback(
    (placed: ReturnType<typeof placePlants>): PlacedWithCare[] =>
      placed.map((p) => {
        const c = careOf(p.plant.id);
        const name = nameOf(p.plant.species);
        return {
          ...p,
          material: c.special ? "esmalte" : p.material === "esmalte" ? "marfil" : p.material,
          thirsty: c.thirsty,
          fresh: c.fresh,
          special: c.special,
          label: `${name} completada${c.special ? " · planta especial" : ""}${c.thirsty ? " · tiene sed" : ""}. Ver detalle`,
        };
      }),
    [careOf],
  );
  const desktopPlants = useMemo(() => withCare(placePlants(DESKTOP_SCENE, scenePlants, specialId)), [withCare, scenePlants, specialId]);
  const phonePlants = useMemo(() => withCare(placePlants(PHONE_COLLECTION_SCENE, scenePlants, specialId)), [withCare, scenePlants, specialId]);

  const heroCare = current ? careOf(current.id) : NO_CARE;
  const hero: SceneHero = current
    ? {
        species: asSpecies(current.species),
        stage: current.stage,
        seed: current.visualSeed,
        thirsty: heroCare.thirsty,
        fresh: heroCare.fresh,
        label: `Tu planta actual: ${nameOf(current.species)}, ${STAGE_LABEL[current.stage].toLowerCase()}${heroCare.thirsty ? ", tiene sed" : ""}. Ver detalle`,
      }
    : { species: "helecho", stage: "semilla", seed: 0, thirsty: false, fresh: false, label: "Semilla nueva. Tu primera sesión de enfoque la hará nacer" };

  // En el iPhone la planta actual vive sola en su escena: se agranda según su
  // especie para que una semilla de helecho no se pierda (el escritorio
  // conserva la escala física entre plantas).
  const phoneHeroScene = useMemo(
    () => ({ ...PHONE_HERO_SCENE, scale: Math.min(3, Math.max(0.85, 140 / SPECIES_SCALE[hero.species].cm)) }),
    [hero.species],
  );

  const select = (id: string) => setOpenId(id === "actual" ? (current?.id ?? null) : id);

  /* ── acciones ── */

  const water = async (plantId: string) => {
    const name = nameOf(current?.id === plantId ? current.species : (all.get(plantId)?.species ?? ""));
    setPending(true);
    const res = await waterPlantAction(plantId).catch(() => null);
    setPending(false);
    if (!res?.ok) {
      toast.show({ tone: "info", message: res?.reason === "sin-agua" ? "No te queda Agua. Completa tareas para ganar más; tu planta espera sin empeorar." : "No se pudo regar. Intenta de nuevo." });
      return;
    }
    setOpenId(null);
    setOverrides((o) => ({ ...o, [plantId]: { ...o[plantId], thirsty: false, fresh: true } }));
    setMoment({ id: current?.id === plantId ? "actual" : plantId, kind: "agua" });
    toast.show({
      tone: "ok",
      message: `${name} ya está hidratada`,
      action: {
        label: "Deshacer",
        onClick: async () => {
          const ok = await undoWaterAction(plantId, res.rewardId, res.prevThirsty, res.prevWatered).catch(() => false);
          if (ok) router.refresh();
          else toast.show({ tone: "warn", message: "Ya no se puede deshacer ese riego." });
        },
      },
    });
    router.refresh();
  };

  const fertilize = async (plantId: string) => {
    const name = nameOf(all.get(plantId)?.species ?? "");
    setPending(true);
    const res = await fertilizePlantAction(plantId).catch(() => null);
    setPending(false);
    if (!res?.ok) {
      toast.show({ tone: "info", message: res?.reason === "sin-fertilizante" ? "No te queda Fertilizante. Sale 1 de cada 6 recompensas." : "No se pudo fertilizar. Intenta de nuevo." });
      return;
    }
    setOpenId(null);
    setOverrides((o) => ({ ...o, [plantId]: { ...o[plantId], fertilized: true, thirsty: false } }));
    setSpecialOverride({ id: plantId });
    setMoment({ id: plantId, kind: "especial" });
    toast.show({
      tone: "ok",
      message: `${name} luce su versión especial`,
      action: {
        label: "Deshacer",
        onClick: async () => {
          const ok = await undoFertilizeAction(plantId, res.rewardId, res.prevSpecial, res.prevThirsty).catch(() => false);
          if (ok) router.refresh();
          else toast.show({ tone: "warn", message: "Ya no se puede deshacer." });
        },
      },
    });
    router.refresh();
  };

  const feature = async (plantId: string | null) => {
    setPending(true);
    const res = await featurePlantAction(plantId).catch(() => null);
    setPending(false);
    if (!res?.ok) {
      toast.show({ tone: "info", message: "No se pudo cambiar la planta especial." });
      return;
    }
    setOpenId(null);
    setSpecialOverride({ id: plantId });
    if (plantId) {
      setOverrides((o) => ({ ...o, [plantId]: { ...o[plantId], thirsty: false } }));
      setMoment({ id: plantId, kind: "especial" });
    }
    const prev = res.prevSpecial;
    toast.show({
      tone: "ok",
      message: plantId ? `${nameOf(all.get(plantId)?.species ?? "")} es tu planta especial` : "Ninguna planta se luce como especial",
      action: {
        label: "Deshacer",
        onClick: async () => {
          await featurePlantAction(prev).catch(() => null);
          router.refresh();
        },
      },
    });
    router.refresh();
  };

  /* ── detalle abierto ── */

  const openPlant: PlantDetailData | null = useMemo(() => {
    if (!openId) return null;
    if (current && openId === current.id) return current;
    const p = all.get(openId) ?? greenhouse.find((x) => x.id === openId);
    return p ? { ...p, stage: "planta-completa", next: null } : null;
  }, [openId, current, all, greenhouse]);

  const specialName = specialId ? nameOf(all.get(specialId)?.species ?? "") : null;

  const carePanel = (p: PlantDetailData) => {
    const c = careOf(p.id);
    const completed = !!p.completedAt;
    const opt = careOptions(c, completed, serverCare.inventory);
    const inv = serverCare.inventory;
    return (
      <div className="mt-5 border-t border-sand pt-4 flex flex-col gap-3 text-left" data-testid="garden-care">
        {c.special && (
          <p className="text-sm text-forest flex items-center gap-2" data-testid="garden-care-special">
            <Sparkles size={15} aria-hidden /> Es tu planta especial: luce su versión exuberante.
          </p>
        )}
        {c.thirsty ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-stone">Tiene sed. Se ve apagada, pero no pierde nada: espera tranquila hasta que la riegues.</p>
            <button type="button" className="btn btn-primary self-start" disabled={!opt.canWater || pending} onClick={() => water(p.id)} data-testid="garden-care-water">
              <Droplet size={15} aria-hidden /> Regar · usa 1 Agua
            </button>
            {inv.agua === 0 && <p className="text-xs text-stone-soft">No te queda Agua. Completa tareas para ganar más.</p>}
          </div>
        ) : (
          !c.special && <p className="text-xs text-stone-soft">Está hidratada.</p>
        )}
        {completed && !c.fertilized && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-stone">
              El Fertilizante desbloquea para siempre su versión especial y la vuelve tu planta especial.
              {specialName && specialId !== p.id ? ` ${specialName} dejará de lucirse, pero conserva su versión especial para volver a destacarla gratis.` : ""}
            </p>
            <button type="button" className="btn btn-secondary self-start" disabled={!opt.canFertilize || pending} onClick={() => fertilize(p.id)} data-testid="garden-care-fertilize">
              <Sparkles size={15} aria-hidden /> Fertilizar · usa 1 Fertilizante
            </button>
            {inv.fertilizante === 0 && <p className="text-xs text-stone-soft">No te queda Fertilizante. Sale 1 de cada 6 recompensas.</p>}
          </div>
        )}
        {opt.canFeature && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-stone">Ya tiene su versión especial. Destacarla es gratis{specialName ? `; ${specialName} volverá a su versión normal` : ""}.</p>
            <button type="button" className="btn btn-secondary self-start" disabled={pending} onClick={() => feature(p.id)} data-testid="garden-care-feature">
              <Star size={15} aria-hidden /> Destacar como especial
            </button>
          </div>
        )}
        {opt.canUnfeature && (
          <button type="button" className="btn btn-ghost self-start" disabled={pending} onClick={() => feature(null)} data-testid="garden-care-unfeature">
            <StarOff size={15} aria-hidden /> Dejar de destacarla
          </button>
        )}
        {!completed && <p className="text-xs text-stone-soft">El Fertilizante se usa en plantas completadas. Esta crece solo con tu enfoque.</p>}
      </div>
    );
  };

  /* ── ficha de la planta actual ── */

  const caption = (
    <div className="min-w-0">
      <p id="planta-actual" className="section-eyebrow">
        Planta actual
      </p>
      {current ? (
        <>
          <h2 className="text-2xl md:text-[26px] leading-tight text-forest-deep mt-1" data-testid="garden-current-species">
            {nameOf(current.species)}
          </h2>
          <p className="font-display italic text-[13px] text-stone">{LATIN[asSpecies(current.species)]}</p>
          <p className="text-sm text-stone mt-2" data-testid="garden-current-stage">
            {STAGE_LABEL[current.stage]} · en su frasco
          </p>
          <p className="text-sm text-stone" data-testid="garden-current-progress">
            {current.next
              ? `${current.accumulatedMinutes} de ${current.accumulatedMinutes + current.next.missingMinutes} min para ${STAGE_LABEL[current.next.key].toLowerCase()}`
              : "Tu planta está completa"}
          </p>
          <span className="block h-[3px] rounded-full bg-sand mt-2 overflow-hidden" aria-hidden>
            <i className="block h-full rounded-full bg-sage-deep" style={{ width: `${Math.min(100, (current.accumulatedMinutes / 150) * 100)}%` }} />
          </span>
          {heroCare.thirsty && (
            <p className="text-xs text-stone mt-2 flex items-center gap-1.5" data-testid="garden-current-thirsty">
              <Droplet size={13} aria-hidden /> Tiene sed · tócala para regarla
            </p>
          )}
        </>
      ) : (
        <>
          <h2 className="text-2xl text-forest-deep mt-1" data-testid="garden-current-species">
            Semilla nueva
          </h2>
          <p className="text-sm text-stone mt-1" data-testid="garden-current-stage">
            {STAGE_LABEL.semilla} · en su frasco de propagación
          </p>
          <p className="text-sm text-stone mt-1" data-testid="garden-current-progress">
            Tu primera sesión de enfoque la hará nacer
          </p>
        </>
      )}
      <div className="mt-3">
        <GardenFocusButton testid="garden-focus" />
      </div>
    </div>
  );

  const desktop = isDesktop !== false;
  const phone = isDesktop !== true;
  const total = garden.totalCompleted;

  return (
    <>
      <GardenFilters />
      <section aria-labelledby="planta-actual" className="mb-10" data-testid="garden-current">
        <div className="relative" data-garden-stage>
          {desktop && (
            <div className={isDesktop === null ? "hidden md:block" : undefined}>
              <GreenhouseScene
                template={DESKTOP_SCENE}
                plants={desktopPlants}
                hero={hero}
                moment={moment}
                onSelect={select}
                label="Tu invernadero"
                className="rounded-[22px] shadow-[0_24px_60px_-30px_rgba(40,46,30,0.35)]"
              />
            </div>
          )}
          {phone && (
            <div className={isDesktop === null ? "md:hidden" : undefined}>
              <GreenhouseScene template={phoneHeroScene} plants={[]} hero={hero} moment={moment} onSelect={select} label="Tu planta actual" className="rounded-[20px]" />
            </div>
          )}
          {/* Una sola ficha: encima de la escena en escritorio, debajo en iPhone. */}
          <div data-scene-cover className="pt-4 px-1 md:absolute md:left-[2.4%] md:top-[4%] md:max-w-[300px] md:p-4 md:rounded-2xl md:border md:border-white/40 md:bg-paper/80 md:backdrop-blur-md md:z-[1800]">
            {caption}
          </div>
        </div>
      </section>

      {rewards}

      {phone && (
        <section aria-labelledby="tu-invernadero-movil" className={`mb-10 ${isDesktop === null ? "md:hidden" : ""}`}>
          <h2 id="tu-invernadero-movil" className="font-display text-2xl text-forest-deep">
            Tu invernadero
          </h2>
          <p className="text-sm text-stone mb-3">
            {total === 0 ? "Aquí vivirán tus plantas completadas." : `${total} ${total === 1 ? "planta" : "plantas"} · la próxima es una sorpresa`}
          </p>
          <GreenhouseScene template={PHONE_COLLECTION_SCENE} plants={phonePlants} hero={null} moment={moment} onSelect={select} label="Tu colección" className="rounded-[18px]" />
        </section>
      )}

      {/* La colección completa, con su paginación: ninguna planta se pierde por no caber en la escena. */}
      <section aria-labelledby="tu-jardin">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 id="tu-jardin" className="section-eyebrow">
            El invernadero
          </h2>
          {total > 0 && (
            <p className="text-xs text-stone-soft">
              {total} {total === 1 ? "planta completada" : "plantas completadas"}
            </p>
          )}
        </div>
        {greenhouse.length === 0 ? (
          <EmptyState variant="semilla" title="Tu jardín está esperando su primera planta." hint="Cada minuto de enfoque la acerca.">
            <GardenFocusButton variant="secondary" testid="garden-empty-focus" />
          </EmptyState>
        ) : (
          <>
            <ul className="grid gap-4 grid-cols-2 lg:grid-cols-3" data-testid="garden-grid">
              {greenhouse.map((p) => {
                const c = careOf(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(p.id)}
                      aria-label={`Ver detalle de tu ${nameOf(p.species)} completada${c.special ? ", planta especial" : ""}${c.thirsty ? ", tiene sed" : ""}`}
                      className="card w-full h-full p-4 flex flex-col items-center text-center relative"
                      data-testid="garden-plant"
                      data-thirsty={c.thirsty || undefined}
                      data-special={c.special || undefined}
                    >
                      {(c.thirsty || c.special) && (
                        <span className="absolute top-3 right-3 h-7 w-7 rounded-full bg-sage-soft text-forest flex items-center justify-center" aria-hidden>
                          {c.special ? <Sparkles size={14} /> : <Droplet size={14} />}
                        </span>
                      )}
                      <PlantArt
                        species={asSpecies(p.species) as PlantSpeciesV2}
                        visualSeed={p.visualSeed}
                        stage="planta-completa"
                        size="small"
                        className={`h-28 w-28 md:h-32 md:w-32 text-sage-deep transition-[filter] ${c.thirsty ? "[filter:saturate(0.3)_sepia(0.55)_hue-rotate(-14deg)_contrast(0.85)] scale-y-[0.88] origin-bottom" : ""}`}
                      />
                      <p className="font-display text-lg text-forest-deep mt-2">{nameOf(p.species)}</p>
                      <p className="text-xs text-stone mt-0.5">Completada el {fecha(p.completedAt)}</p>
                      <p className="text-xs text-stone-soft">{p.accumulatedMinutes} min de enfoque</p>
                    </button>
                  </li>
                );
              })}
            </ul>
            {total > greenhouse.length && (
              <div className="mt-5 flex justify-center">
                <Link href={`/biblioteca/jardin?mostrar=${shown + 12}`} scroll={false} className="btn btn-secondary" data-testid="garden-more">
                  Ver más ({total - greenhouse.length} restantes)
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      {openPlant && (
        <PlantDetailModal plant={openPlant} onClose={() => setOpenId(null)}>
          {carePanel(openPlant)}
        </PlantDetailModal>
      )}
    </>
  );
}
