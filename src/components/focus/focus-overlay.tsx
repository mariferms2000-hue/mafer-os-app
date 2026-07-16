"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { X, Play, Pause, CheckCircle2, SkipForward, Leaf, Sprout } from "lucide-react";
import {
  getFocusOverviewAction,
  startFocusAction,
  focusTransitionAction,
  recoverFocusAction,
  discardFocusAction,
} from "@/lib/actions/focus";
import type { FocusOverview } from "@/lib/queries/focus";
import {
  PRESETS,
  CUSTOM_FOCUS_MIN,
  CUSTOM_FOCUS_MAX,
  clampCustomFocus,
  STAGES,
  plantStage,
  nextStageInfo,
  focusRemainingSeconds,
  breakRemainingSeconds,
  focusElapsedSeconds,
  formatClock,
  type FocusState,
  type FocusAction,
  type PresetKey,
  type StageKey,
} from "@/lib/focus-logic";
import { FocusPlant } from "./plant";

/* Overlay de Focus Garden — Fase 7C. Un solo elemento dominante (el tiempo),
   máximo un botón primario por estado, lenguaje sereno y sin culpa.
   La fuente de verdad es el motor de 7B (timestamps persistidos); el
   setInterval de aquí SOLO pinta. Cerrar el overlay nunca termina la sesión. */

type Session = NonNullable<FocusOverview["openSession"]>;

type ClosedInfo = {
  outcome: string;
  creditedMinutes: number;
  plantCompleted: boolean;
  cardTitle: string | null;
};

const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<
  StageKey,
  string
>;

function toState(s: Session): FocusState {
  return {
    phase: s.phase as FocusState["phase"],
    phaseStartedAt: s.phaseStartedAt,
    elapsedFocusSeconds: s.elapsedFocusSeconds,
    elapsedBreakSeconds: s.elapsedBreakSeconds,
    plannedFocusMin: s.plannedFocusMin,
    plannedBreakMin: s.plannedBreakMin,
  };
}

/** Abre el overlay reflejándolo en la URL (?focus=1), como el detalle de tarea. */
export function openFocusUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("focus", "1");
  window.history.pushState(null, "", url.toString());
}

function closeFocusUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("focus");
  window.history.replaceState(null, "", url.toString());
}

/** Montado una vez en el layout: ?focus=1 abre el overlay desde cualquier página. */
export function FocusOverlayFromUrl() {
  const searchParams = useSearchParams();
  if (searchParams.get("focus") !== "1") return null;
  return <FocusOverlay onClose={closeFocusUrl} />;
}

export function FocusOverlay({ onClose }: { onClose: () => void }) {
  const [overview, setOverview] = useState<FocusOverview | null>(null);
  const [closed, setClosed] = useState<ClosedInfo | null>(null);
  const [preset, setPreset] = useState<PresetKey>("pomodoro");
  const [customMin, setCustomMin] = useState(25);
  const [customBreak, setCustomBreak] = useState(true);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [pending, start] = useTransition();
  const [, forceTick] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const completingRef = useRef(false);

  const session = overview?.openSession ?? null;

  const refresh = useCallback(async () => {
    const o = await getFocusOverviewAction();
    setOverview(o);
    return o;
  }, []);

  // Carga inicial + recuperación honesta si había una sesión abierta.
  useEffect(() => {
    let alive = true;
    (async () => {
      const o = await getFocusOverviewAction();
      if (!alive) return;
      if (o.openSession) {
        const r = await recoverFocusAction(o.openSession.id);
        if (!alive) return;
        if (r.finished) {
          setClosed({
            outcome: r.outcome ?? "completa",
            creditedMinutes: r.creditedMinutes ?? 0,
            plantCompleted: Boolean(r.plantCompleted),
            cardTitle: o.openSession.cardTitle,
          });
          setAnnouncement("Tu sesión anterior terminó mientras la app estaba cerrada.");
        }
        const fresh = await getFocusOverviewAction();
        if (alive) setOverview(fresh);
      } else {
        setOverview(o);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // El intervalo SOLO pinta: recalcula desde timestamps y dispara la
  // transición de fin de fase cuando el motor dice que el tiempo se agotó.
  useEffect(() => {
    if (!session || (session.phase !== "enfoque" && session.phase !== "descanso")) return;
    const idInterval = setInterval(() => {
      forceTick((t) => t + 1);
      const s = toState(session);
      const nowIso = new Date().toISOString();
      const due =
        session.phase === "enfoque" ? focusRemainingSeconds(s, nowIso) <= 0 : breakRemainingSeconds(s, nowIso) <= 0;
      if (due && !completingRef.current) {
        completingRef.current = true;
        const action: FocusAction = session.phase === "enfoque" ? "completar-enfoque" : "terminar-descanso";
        void applyAction(action).finally(() => {
          completingRef.current = false;
        });
      }
    }, 500);
    return () => clearInterval(idInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.phase, session?.phaseStartedAt]);

  // Accesibilidad: Escape cierra el overlay sin cancelar nada; Tab queda dentro.
  useEffect(() => {
    dialogRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al volver a la pestaña (Safari congela procesos): repintar y recuperar.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") forceTick((t) => t + 1);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  async function applyAction(action: FocusAction) {
    if (!session) return;
    const r = await focusTransitionAction(session.id, action);
    if (r.finished) {
      setClosed({
        outcome: r.outcome ?? "completa",
        creditedMinutes: r.creditedMinutes ?? 0,
        plantCompleted: Boolean(r.plantCompleted),
        cardTitle: session.cardTitle,
      });
      setAnnouncement(
        r.outcome === "terminada-antes"
          ? `Sesión guardada con ${r.creditedMinutes} minutos de enfoque.`
          : "Ciclo completo."
      );
    } else {
      setAnnouncement(
        action === "pausar"
          ? "En pausa."
          : action === "reanudar"
            ? "Reanudado."
            : action === "empezar-descanso"
              ? "Descanso iniciado."
              : action === "completar-enfoque"
                ? "Bloque de enfoque completo."
                : ""
      );
    }
    await refresh();
  }

  function act(action: FocusAction) {
    start(() => applyAction(action));
  }

  function begin() {
    start(async () => {
      await startFocusAction({
        preset,
        customFocusMin: preset === "personalizado" ? clampCustomFocus(customMin) : undefined,
        customWithBreak: preset === "personalizado" ? customBreak : undefined,
      });
      setClosed(null);
      setAnnouncement("Sesión de enfoque iniciada.");
      await refresh();
    });
  }

  function discard() {
    if (!session) return;
    start(async () => {
      await discardFocusAction(session.id);
      setConfirmDiscard(false);
      setClosed({ outcome: "descartada", creditedMinutes: 0, plantCompleted: false, cardTitle: session.cardTitle });
      setAnnouncement("Sesión descartada. Quedó en el registro, sin minutos abonados.");
      await refresh();
    });
  }

  function anotherSession() {
    setClosed(null);
    setConfirmDiscard(false);
  }

  const nowIso = new Date().toISOString();

  return (
    <div className="fixed inset-0 z-[60] overlay-screen flex items-center justify-center p-4" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Focus Garden"
        tabIndex={-1}
        className="card card-raised glow-focus w-full max-w-lg p-6 md:p-8 text-center max-h-[92dvh] overflow-y-auto"
        data-testid="focus-overlay"
      >
        <p aria-live="polite" className="sr-only" data-testid="focus-announcement">
          {announcement}
        </p>

        <div className="relative flex items-center justify-center mb-4">
          <h2 className="section-eyebrow !text-sage-deep flex items-center gap-1.5">
            <Sprout size={13} aria-hidden /> Focus Garden
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={session && !closed ? "Cerrar — la sesión sigue corriendo" : "Cerrar"}
            className="btn btn-ghost !p-1.5 absolute right-0 top-1/2 -translate-y-1/2"
            data-testid="focus-close"
          >
            <X size={17} aria-hidden />
          </button>
        </div>

        {overview === null ? (
          <p className="text-sm text-stone py-10">Abriendo tu jardín…</p>
        ) : closed ? (
          <ClosedView info={closed} overview={overview} onAnother={anotherSession} onBack={onClose} />
        ) : session ? (
          <ActiveView
            session={session}
            overview={overview}
            nowIso={nowIso}
            pending={pending}
            act={act}
            confirmDiscard={confirmDiscard}
            setConfirmDiscard={setConfirmDiscard}
            discard={discard}
          />
        ) : (
          <ReadyView
            overview={overview}
            preset={preset}
            setPreset={setPreset}
            customMin={customMin}
            setCustomMin={setCustomMin}
            customBreak={customBreak}
            setCustomBreak={setCustomBreak}
            pending={pending}
            begin={begin}
          />
        )}
      </div>
    </div>
  );
}

/* ── Estado listo ─────────────────────────────────────────────── */

function ReadyView({
  overview,
  preset,
  setPreset,
  customMin,
  setCustomMin,
  customBreak,
  setCustomBreak,
  pending,
  begin,
}: {
  overview: FocusOverview;
  preset: PresetKey;
  setPreset: (p: PresetKey) => void;
  customMin: number;
  setCustomMin: (n: number) => void;
  customBreak: boolean;
  setCustomBreak: (b: boolean) => void;
  pending: boolean;
  begin: () => void;
}) {
  const plant = overview.plant;
  const stage = plant ? plant.stage : "semilla";
  const next = plant ? plant.next : nextStageInfo(0);

  return (
    <div className="flex flex-col items-center gap-4">
      <FocusPlant stage={stage} className="h-28 w-28 text-sage-deep" />
      <div>
        <p className="text-sm font-medium text-charcoal">{STAGE_LABEL[stage]}</p>
        <p className="text-xs text-stone mt-0.5">
          {plant ? `${plant.accumulatedMinutes} min de enfoque acumulados` : "Tu primera semilla te espera"}
          {next ? ` · faltan ${next.missingMinutes} para ${STAGE_LABEL[next.key].toLowerCase()}` : ""}
        </p>
        {overview.todayMinutes > 0 && (
          <p className="text-xs text-stone-soft mt-0.5">Hoy: {overview.todayMinutes} min de enfoque</p>
        )}
      </div>

      <span className="chip" data-testid="focus-task">
        <Leaf size={11} aria-hidden /> Enfoque libre
      </span>

      <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label="Duración de la sesión">
        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setPreset(k)}
            aria-pressed={preset === k}
            className={`chip !py-1.5 !px-3 ${preset === k ? "chip-on" : "hover:bg-surface-hover"}`}
            data-testid={`focus-preset-${k}`}
          >
            {PRESETS[k].label} · {PRESETS[k].focusMin}
            {PRESETS[k].breakMin ? `+${PRESETS[k].breakMin}` : ""}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreset("personalizado")}
          aria-pressed={preset === "personalizado"}
          className={`chip !py-1.5 !px-3 ${preset === "personalizado" ? "chip-on" : "hover:bg-surface-hover"}`}
          data-testid="focus-preset-personalizado"
        >
          Personalizado
        </button>
      </div>

      {preset === "personalizado" && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <label className="flex items-center gap-2 text-sm text-stone">
            Minutos de enfoque
            <input
              type="number"
              min={CUSTOM_FOCUS_MIN}
              max={CUSTOM_FOCUS_MAX}
              value={customMin}
              onChange={(e) => setCustomMin(Number(e.target.value))}
              onBlur={() => setCustomMin(clampCustomFocus(customMin))}
              className="input !w-20 text-center"
              aria-label={`Minutos de enfoque, entre ${CUSTOM_FOCUS_MIN} y ${CUSTOM_FOCUS_MAX}`}
              data-testid="focus-custom-min"
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-stone">
            <input
              type="checkbox"
              checked={customBreak}
              onChange={(e) => setCustomBreak(e.target.checked)}
              data-testid="focus-custom-break"
            />
            con descanso de 5 min
          </label>
        </div>
      )}

      <button type="button" className="btn btn-primary !px-8" onClick={begin} disabled={pending} data-testid="focus-start">
        <Play size={15} aria-hidden /> {pending ? "Empezando…" : "Empezar"}
      </button>
      <p className="intro-italic text-[13px]">Una planta crece mientras trabajas. Sin prisa.</p>
    </div>
  );
}

/* ── Sesión activa (enfoque, pausa, enfoque listo, descanso) ───── */

function ActiveView({
  session,
  overview,
  nowIso,
  pending,
  act,
  confirmDiscard,
  setConfirmDiscard,
  discard,
}: {
  session: Session;
  overview: FocusOverview;
  nowIso: string;
  pending: boolean;
  act: (a: FocusAction) => void;
  confirmDiscard: boolean;
  setConfirmDiscard: (b: boolean) => void;
  discard: () => void;
}) {
  const s = toState(session);
  const plant = overview.plant;
  const stage = plant ? plant.stage : "semilla";
  const phase = session.phase as FocusState["phase"];
  const focusDone = Math.floor(focusElapsedSeconds(s, nowIso) / 60);

  const clock =
    phase === "descanso" || phase === "descanso-pausado"
      ? formatClock(breakRemainingSeconds(s, nowIso))
      : formatClock(focusRemainingSeconds(s, nowIso));

  const isBreak = phase === "descanso" || phase === "descanso-pausado";
  const paused = phase === "pausado" || phase === "descanso-pausado";

  // Al completar el enfoque: proyección honesta de la planta (se abona al cerrar).
  const projected = plant ? plantStage(plant.accumulatedMinutes + focusDone) : "semilla";
  const advances = plant && projected !== plant.stage;

  return (
    <div className="flex flex-col items-center gap-4">
      {phase === "enfoque-listo" ? (
        <>
          <p className="text-lg font-medium text-charcoal flex items-center gap-2">
            <CheckCircle2 size={20} className="text-done" aria-hidden /> Bloque completo
          </p>
          <p className="text-sm text-stone" data-testid="focus-done-minutes">
            {focusDone} minutos de enfoque — se abonan a tu planta al cerrar el ciclo.
            {advances ? ` Pasará a ${STAGE_LABEL[projected].toLowerCase()}.` : ""}
          </p>
          <FocusPlant stage={stage} className="h-24 w-24 text-sage-deep" />
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => act("empezar-descanso")} disabled={pending} data-testid="focus-start-break">
              Descansar {session.plannedBreakMin} min
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => act("saltar-descanso")} disabled={pending} data-testid="focus-skip-break">
              <SkipForward size={14} aria-hidden /> Saltar y cerrar el ciclo
            </button>
          </div>
        </>
      ) : (
        <>
          <p
            className={`font-semibold tabular-nums leading-none ${isBreak ? "text-5xl md:text-6xl text-stone" : "text-6xl md:text-7xl text-charcoal"}`}
            data-testid="focus-clock"
            aria-label={`Tiempo restante ${clock}`}
          >
            {clock}
          </p>
          <p className="text-xs text-stone-soft -mt-1">
            {isBreak ? "Descanso" : "Enfoque"}
            {paused ? " · en pausa" : ""}
          </p>

          <FocusPlant stage={stage} className={`h-20 w-20 ${isBreak ? "text-sage/70" : "text-sage-deep"}`} />

          <span className="chip" data-testid="focus-task">
            <Leaf size={11} aria-hidden /> {session.cardTitle ?? "Enfoque libre"}
          </span>

          <p className="intro-italic text-[13px]" data-testid="focus-phrase">
            {phase === "pausado"
              ? "En pausa — está bien parar."
              : phase === "descanso-pausado"
                ? "Descanso en pausa. Vuelve cuando quieras."
                : isBreak
                  ? "Respira. La planta también descansa."
                  : "Una cosa a la vez. El resto puede esperar."}
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            {phase === "enfoque" && (
              <>
                <button type="button" className="btn btn-primary" onClick={() => act("pausar")} disabled={pending} data-testid="focus-pause">
                  <Pause size={15} aria-hidden /> Pausar
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => act("terminar-antes")} disabled={pending} data-testid="focus-end-early">
                  Terminar antes
                </button>
              </>
            )}
            {phase === "pausado" && (
              <>
                <button type="button" className="btn btn-primary" onClick={() => act("reanudar")} disabled={pending} data-testid="focus-resume">
                  <Play size={15} aria-hidden /> Reanudar
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => act("terminar-antes")} disabled={pending} data-testid="focus-end-early">
                  Terminar antes
                </button>
              </>
            )}
            {phase === "descanso" && (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => act("pausar")} disabled={pending} data-testid="focus-pause">
                  <Pause size={14} aria-hidden /> Pausar
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => act("saltar-descanso")} disabled={pending} data-testid="focus-skip-break">
                  <SkipForward size={14} aria-hidden /> Saltar descanso
                </button>
              </>
            )}
            {phase === "descanso-pausado" && (
              <>
                <button type="button" className="btn btn-primary" onClick={() => act("reanudar")} disabled={pending} data-testid="focus-resume">
                  <Play size={15} aria-hidden /> Reanudar
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => act("terminar-descanso")} disabled={pending} data-testid="focus-end-break">
                  Terminar descanso
                </button>
              </>
            )}
          </div>

          {(phase === "enfoque" || phase === "pausado") && (
            <div className="mt-1">
              {confirmDiscard ? (
                <span className="text-xs text-stone flex items-center gap-2">
                  ¿Descartar sin abonar minutos?
                  <button type="button" className="btn btn-danger !py-1 !px-2 text-xs" onClick={discard} data-testid="focus-discard-confirm">
                    Sí, descartar
                  </button>
                  <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setConfirmDiscard(false)}>
                    No
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="text-xs text-stone-soft underline underline-offset-4 hover:text-stone"
                  onClick={() => setConfirmDiscard(true)}
                  data-testid="focus-discard"
                >
                  Descartar sesión
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Ciclo cerrado / terminada antes ──────────────────────────── */

function ClosedView({
  info,
  overview,
  onAnother,
  onBack,
}: {
  info: ClosedInfo;
  overview: FocusOverview;
  onAnother: () => void;
  onBack: () => void;
}) {
  const plant = overview.plant;
  const stage = plant ? plant.stage : "semilla";
  const early = info.outcome === "terminada-antes";
  const discarded = info.outcome === "descartada";

  return (
    <div className="flex flex-col items-center gap-4" data-testid="focus-summary">
      <p className="text-lg font-medium text-charcoal flex items-center gap-2">
        <CheckCircle2 size={20} className="text-done" aria-hidden />
        {discarded ? "Sesión descartada" : early ? "Sesión guardada" : "Ciclo completo"}
      </p>

      {info.plantCompleted ? (
        <p className="text-sm text-ink-green max-w-xs" data-testid="focus-plant-complete">
          Tu planta está completa y se unió a tu jardín. Nace una semilla nueva. 🌿
        </p>
      ) : null}

      <FocusPlant stage={stage} className="h-24 w-24 text-sage-deep" />

      <div className="text-sm text-stone flex flex-col gap-0.5">
        <p data-testid="focus-credited">
          {discarded
            ? "Sin minutos abonados — la sesión quedó en el registro."
            : `${info.creditedMinutes} min de enfoque abonados a tu planta.`}
        </p>
        {early && !discarded && <p className="text-xs text-stone-soft">Cuentan igual. Parar antes también es cuidar el foco.</p>}
        <p className="text-xs text-stone-soft">
          {info.cardTitle ?? "Enfoque libre"} · {STAGE_LABEL[stage]}
          {plant ? ` · ${plant.accumulatedMinutes} min acumulados` : ""}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-primary" onClick={onAnother} data-testid="focus-another">
          Otra sesión
        </button>
        <button type="button" className="btn btn-ghost" onClick={onBack} data-testid="focus-back-app">
          Volver a Mafer OS
        </button>
      </div>
    </div>
  );
}
