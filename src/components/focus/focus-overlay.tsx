"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { X, Play, Pause, CheckCircle2, SkipForward, Leaf, Sprout, ChevronDown, Volume2, VolumeX } from "lucide-react";
import {
  getFocusOverviewAction,
  getFocusPickerAction,
  startFocusAction,
  focusTransitionAction,
  recoverFocusAction,
  discardFocusAction,
} from "@/lib/actions/focus";
import { completeCardAction } from "@/lib/actions/cards";
import { openTaskUrl } from "@/components/tasks/task-detail";
import { useToast } from "@/components/ui/toast";
import type { FocusOverview, FocusPickerOption } from "@/lib/queries/focus";
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
import { primeFocusAudio, playFocusChime, isFocusSoundMuted, setFocusSoundMuted } from "@/lib/focus-sound";
import { FocusPlant } from "./plant";

/* «Jardín de enfoque» — Fase 7C.1: la habitación de enfoque de Mafer OS.
   Overlay amplio e inmersivo con el Marco vivo en el contenedor principal,
   la planta como protagonista y un solo botón primario por estado.
   Toda la lógica, persistencia y recuperación son las de 7B/7C: el
   setInterval SOLO pinta; cerrar el overlay nunca termina la sesión. */

type Session = NonNullable<FocusOverview["openSession"]>;

type ClosedInfo = {
  outcome: string;
  creditedMinutes: number;
  plantCompleted: boolean;
  cardId: string | null;
  cardTitle: string | null;
};

type Picker = {
  suggested: FocusPickerOption | null;
  priorities: FocusPickerOption[];
  preselect: FocusPickerOption | null;
};

const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<
  StageKey,
  string
>;

/** Sustantivo sereno para «Tu … sigue creciendo». */
const STAGE_NOUN: Record<StageKey, string> = {
  semilla: "semilla",
  brote: "brote",
  hojas: "planta",
  "planta-joven": "planta",
  "planta-completa": "planta",
};

const PRESET_HINT: Record<Exclude<PresetKey, "personalizado">, string> = {
  arranque: "5 min · solo empezar",
  ligero: "15 min + 5 de descanso",
  pomodoro: "25 min + 5 de descanso",
  profundo: "45 min + 10 de descanso",
};

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

/** Abre el overlay reflejándolo en la URL (?focus=1), como el detalle de tarea.
 *  Con `cardId`, la tarea llega preseleccionada (?ftarea=<id>). */
export function openFocusUrl(cardId?: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("focus", "1");
  if (cardId) url.searchParams.set("ftarea", cardId);
  else url.searchParams.delete("ftarea");
  window.history.pushState(null, "", url.toString());
}

function closeFocusUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("focus");
  url.searchParams.delete("ftarea");
  window.history.replaceState(null, "", url.toString());
}

/** Montado una vez en el layout: ?focus=1 abre el overlay desde cualquier página. */
export function FocusOverlayFromUrl() {
  const searchParams = useSearchParams();
  if (searchParams.get("focus") !== "1") return null;
  return <FocusOverlay onClose={closeFocusUrl} preselectCardId={searchParams.get("ftarea")} />;
}

export function FocusOverlay({ onClose, preselectCardId }: { onClose: () => void; preselectCardId?: string | null }) {
  const [overview, setOverview] = useState<FocusOverview | null>(null);
  const [closed, setClosed] = useState<ClosedInfo | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [selectedTask, setSelectedTask] = useState<FocusPickerOption | null>(null);
  const [preset, setPreset] = useState<PresetKey>("pomodoro");
  const [customMin, setCustomMin] = useState(25);
  const [customBreak, setCustomBreak] = useState(true);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [pending, start] = useTransition();
  const [, forceTick] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const completingRef = useRef(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const soundMutedRef = useRef(false);

  // Sincroniza la preferencia de silencio guardada — arranca en false para
  // no desajustar la hidratación, se corrige al montar en cliente.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura de localStorage, solo resoluble tras montar (SSR-safe)
    setSoundMuted(isFocusSoundMuted());
  }, []);

  // El intervalo de abajo captura closures viejos (sus dependencias no
  // incluyen soundMuted); el ref le da el valor vigente sin reiniciarlo.
  useEffect(() => {
    soundMutedRef.current = soundMuted;
  }, [soundMuted]);

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
            cardId: o.openSession.cardId,
            cardTitle: o.openSession.cardTitle,
          });
          setAnnouncement("Tu sesión anterior terminó mientras la app estaba cerrada.");
        }
        const fresh = await getFocusOverviewAction();
        if (alive) setOverview(fresh);
      } else {
        setOverview(o);
      }
      // opciones para elegir tarea (sugerencia de Hoy + prioridades + preselección)
      const p = await getFocusPickerAction(preselectCardId ?? null);
      if (!alive) return;
      setPicker(p);
      if (p.preselect) setSelectedTask(p.preselect);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (!soundMutedRef.current) playFocusChime();
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
        cardId: session.cardId,
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
    primeFocusAudio();
    start(() => applyAction(action));
  }

  function begin() {
    primeFocusAudio();
    start(async () => {
      await startFocusAction({
        preset,
        cardId: selectedTask?.id ?? null,
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
      setClosed({
        outcome: "descartada",
        creditedMinutes: 0,
        plantCompleted: false,
        cardId: session.cardId,
        cardTitle: session.cardTitle,
      });
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
    <div
      className="fixed inset-0 z-[60] overlay-screen flex items-center justify-center p-3 md:p-8"
      style={{ backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Jardín de enfoque"
        tabIndex={-1}
        className="card card-raised glow-focus w-full max-w-[860px] !rounded-[28px] px-6 py-8 md:px-16 md:py-12 text-center max-h-[94dvh] overflow-y-auto md:min-h-[600px] flex flex-col"
        data-testid="focus-overlay"
      >
        <p aria-live="polite" className="sr-only" data-testid="focus-announcement">
          {announcement}
        </p>

        <div className="relative flex items-center justify-center mb-2">
          <h2 className="section-eyebrow !text-sage-deep flex items-center gap-1.5">
            <Sprout size={13} aria-hidden /> Jardín de enfoque
          </h2>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const next = !soundMuted;
                setSoundMuted(next);
                setFocusSoundMuted(next);
              }}
              aria-label={soundMuted ? "Activar aviso sonoro del pomodoro" : "Silenciar aviso sonoro del pomodoro"}
              aria-pressed={!soundMuted}
              className="btn btn-ghost !p-1.5"
              data-testid="focus-sound-toggle"
            >
              {soundMuted ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={session && !closed ? "Cerrar — la sesión sigue corriendo" : "Cerrar"}
              className="btn btn-ghost !p-1.5"
              data-testid="focus-close"
            >
              <X size={17} aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          {overview === null ? (
            <p className="text-sm text-stone py-16">Abriendo tu jardín…</p>
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
              wantedTask={preselectCardId && preselectCardId !== session.cardId ? (picker?.preselect ?? null) : null}
            />
          ) : (
            <ReadyView
              overview={overview}
              picker={picker}
              selectedTask={selectedTask}
              setSelectedTask={setSelectedTask}
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
    </div>
  );
}

/* ── Estado listo: la planta protagonista y una decisión sencilla ── */

function ReadyView({
  overview,
  picker,
  selectedTask,
  setSelectedTask,
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
  picker: Picker | null;
  selectedTask: FocusPickerOption | null;
  setSelectedTask: (t: FocusPickerOption | null) => void;
  preset: PresetKey;
  setPreset: (p: PresetKey) => void;
  customMin: number;
  setCustomMin: (n: number) => void;
  customBreak: boolean;
  setCustomBreak: (b: boolean) => void;
  pending: boolean;
  begin: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const plant = overview.plant;
  const stage = plant ? plant.stage : "semilla";
  const acc = plant ? plant.accumulatedMinutes : 0;
  const next = plant ? plant.next : nextStageInfo(0);

  // opciones únicas y escaneables: sugerencia de Hoy → prioridades → libre
  const options: FocusPickerOption[] = [];
  if (picker?.preselect && !options.some((o) => o.id === picker.preselect!.id)) options.push(picker.preselect);
  if (picker?.suggested && !options.some((o) => o.id === picker.suggested!.id)) options.push(picker.suggested);
  for (const p of picker?.priorities ?? []) if (!options.some((o) => o.id === p.id)) options.push(p);

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <FocusPlant stage={stage} className="h-44 w-44 md:h-48 md:w-48 text-sage-deep" />

      <div>
        <p className="font-display text-2xl text-forest-deep">{STAGE_LABEL[stage]}</p>
        <p className="text-sm text-stone mt-1">
          {next
            ? `${acc} de ${acc + next.missingMinutes} min para ${STAGE_LABEL[next.key].toLowerCase()}`
            : "Tu planta está completa"}
          {overview.todayMinutes > 0 ? ` · hoy: ${overview.todayMinutes} min` : ""}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 w-full max-w-md">
        <span className="chip !max-w-full" data-testid="focus-task">
          <Leaf size={11} className="shrink-0" aria-hidden />
          <span className="truncate">{selectedTask ? selectedTask.title : "Enfoque libre"}</span>
        </span>
        {options.length > 0 && (
          <button
            type="button"
            className="text-xs text-stone-soft underline underline-offset-4 hover:text-stone"
            onClick={() => setPicking(!picking)}
            aria-expanded={picking}
            data-testid="focus-change-task"
          >
            {selectedTask ? "Cambiar tarea" : "Vincular una tarea"}
          </button>
        )}
        {picking && (
          <ul className="w-full flex flex-col gap-1 text-left" data-testid="focus-task-options">
            {options.map((o, i) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTask(o);
                    setPicking(false);
                  }}
                  aria-pressed={selectedTask?.id === o.id}
                  className={`w-full text-left text-sm rounded-lg px-3 py-2 border ${
                    selectedTask?.id === o.id
                      ? "border-border-focus bg-sage-soft/40"
                      : "border-card-border hover:bg-surface-hover"
                  }`}
                  data-testid={`focus-pick-${i}`}
                >
                  <span className="block truncate">{o.title}</span>
                  <span className="block text-[11px] text-stone-soft">
                    {picker?.suggested?.id === o.id
                      ? "Sugerida por «Haz esto ahora»"
                      : picker?.priorities.some((p) => p.id === o.id)
                        ? "Prioridad de hoy"
                        : "Tarea elegida"}
                  </span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => {
                  setSelectedTask(null);
                  setPicking(false);
                }}
                aria-pressed={!selectedTask}
                className={`w-full text-left text-sm rounded-lg px-3 py-2 border ${
                  !selectedTask ? "border-border-focus bg-sage-soft/40" : "border-card-border hover:bg-surface-hover"
                }`}
                data-testid="focus-pick-libre"
              >
                Enfoque libre
              </button>
            </li>
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 w-full max-w-md" role="group" aria-label="Duración de la sesión">
        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => {
          const on = preset === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setPreset(k)}
              aria-pressed={on}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                on
                  ? "border-border-focus bg-sage-soft/50 shadow-[0_0_0_1px_var(--color-border-focus)]"
                  : "border-card-border hover:border-border-strong hover:bg-surface-hover"
              }`}
              data-testid={`focus-preset-${k}`}
            >
              <span className={`block text-sm font-semibold ${on ? "text-forest-deep" : "text-charcoal"}`}>
                {PRESETS[k].label}
              </span>
              <span className="block text-xs text-stone mt-0.5">{PRESET_HINT[k]}</span>
            </button>
          );
        })}
      </div>

      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => setPreset("personalizado")}
          aria-pressed={preset === "personalizado"}
          aria-expanded={preset === "personalizado"}
          className={`text-xs inline-flex items-center gap-1 underline-offset-4 ${
            preset === "personalizado" ? "text-forest font-medium" : "text-stone-soft hover:text-stone underline"
          }`}
          data-testid="focus-preset-personalizado"
        >
          Personalizado
          <ChevronDown size={12} className={preset === "personalizado" ? "rotate-180" : ""} aria-hidden />
        </button>
        {preset === "personalizado" && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-card-border p-3">
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
      </div>

      <button
        type="button"
        className="btn btn-primary !px-10 !py-2.5 !text-[15px]"
        onClick={begin}
        disabled={pending}
        data-testid="focus-start"
      >
        <Play size={16} aria-hidden /> {pending ? "Empezando…" : "Empezar"}
      </button>
      <p className="intro-italic text-[13px]">Una planta crece mientras trabajas. Sin prisa.</p>
    </div>
  );
}

/* ── Sesión activa: el tiempo manda, la planta acompaña ─────────── */

function ActiveView({
  session,
  overview,
  nowIso,
  pending,
  act,
  confirmDiscard,
  setConfirmDiscard,
  discard,
  wantedTask,
}: {
  session: Session;
  overview: FocusOverview;
  nowIso: string;
  pending: boolean;
  act: (a: FocusAction) => void;
  confirmDiscard: boolean;
  setConfirmDiscard: (b: boolean) => void;
  discard: () => void;
  /** Se llegó queriendo enfocar OTRA tarea: avisar sin sustituir nada en silencio. */
  wantedTask: FocusPickerOption | null;
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
  const projectedNext = plant ? nextStageInfo(plant.accumulatedMinutes + focusDone) : nextStageInfo(focusDone);

  if (phase === "enfoque-listo") {
    return (
      <div className="flex flex-col items-center gap-5">
        <p className="section-eyebrow flex items-center gap-1.5">
          <CheckCircle2 size={13} className="text-done" aria-hidden /> Bloque completo
        </p>
        <p className="font-display text-2xl md:text-3xl text-forest-deep" data-testid="focus-done-minutes">
          Guardaste {focusDone} minutos de enfoque
        </p>
        <FocusPlant stage={stage} className="h-36 w-36 text-sage-deep" />
        <p className="text-sm text-stone">
          {advances ? `Tu planta pasará a ${STAGE_LABEL[projected].toLowerCase()} al cerrar el ciclo.` : `Tu ${STAGE_NOUN[stage]} sigue creciendo.`}
          {projectedNext ? ` Faltan ${projectedNext.missingMinutes} min para ${STAGE_LABEL[projectedNext.key].toLowerCase()}.` : ""}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-primary !px-7" onClick={() => act("empezar-descanso")} disabled={pending} data-testid="focus-start-break">
            Descansar {session.plannedBreakMin} min
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => act("saltar-descanso")} disabled={pending} data-testid="focus-skip-break">
            <SkipForward size={14} aria-hidden /> Saltar y cerrar el ciclo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {wantedTask && (
        <p
          className="text-xs text-stone rounded-lg border border-waiting-soft bg-waiting-soft/40 px-3 py-2 max-w-sm"
          data-testid="focus-conflict"
        >
          Ya hay una sesión en curso. Para enfocar «{wantedTask.title}», primero termina o descarta esta.
        </p>
      )}
      <p
        className={`font-semibold tabular-nums leading-none tracking-tight ${
          isBreak ? "text-6xl md:text-7xl text-stone" : "text-7xl md:text-[84px] text-charcoal"
        } ${paused ? "opacity-90" : ""}`}
        data-testid="focus-clock"
        aria-label={`Tiempo restante ${clock}`}
      >
        {clock}
      </p>
      <p className="section-eyebrow -mt-2">
        {isBreak ? "Descanso" : "Enfoque"}
        {paused ? " · en pausa" : ""}
      </p>

      <FocusPlant
        stage={stage}
        className={`h-32 w-32 md:h-36 md:w-36 ${isBreak ? "text-sage/70" : paused ? "text-sage-deep/80" : "text-sage-deep"}`}
      />

      <p className="text-xs text-stone-soft flex items-center gap-1.5" data-testid="focus-task">
        <Leaf size={11} aria-hidden /> {session.cardTitle ?? "Enfoque libre"}
      </p>

      <p className="intro-italic text-[14px]" data-testid="focus-phrase">
        {phase === "pausado"
          ? "En pausa — está bien parar."
          : phase === "descanso-pausado"
            ? "Descanso en pausa. Vuelve cuando quieras."
            : isBreak
              ? "Respira. La planta también descansa."
              : "Una cosa a la vez. El resto puede esperar."}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {phase === "enfoque" && (
          <>
            <button type="button" className="btn btn-primary !px-8" onClick={() => act("pausar")} disabled={pending} data-testid="focus-pause">
              <Pause size={15} aria-hidden /> Pausar
            </button>
            <button type="button" className="btn btn-ghost text-sm" onClick={() => act("terminar-antes")} disabled={pending} data-testid="focus-end-early">
              Terminar antes
            </button>
          </>
        )}
        {phase === "pausado" && (
          <>
            <button type="button" className="btn btn-primary !px-8" onClick={() => act("reanudar")} disabled={pending} data-testid="focus-resume">
              <Play size={15} aria-hidden /> Reanudar
            </button>
            <button type="button" className="btn btn-ghost text-sm" onClick={() => act("terminar-antes")} disabled={pending} data-testid="focus-end-early">
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
            <button type="button" className="btn btn-primary !px-8" onClick={() => act("reanudar")} disabled={pending} data-testid="focus-resume">
              <Play size={15} aria-hidden /> Reanudar
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => act("terminar-descanso")} disabled={pending} data-testid="focus-end-break">
              Terminar descanso
            </button>
          </>
        )}
      </div>

      {(phase === "enfoque" || phase === "pausado") && (
        <div>
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
    </div>
  );
}

/* ── Ciclo cerrado: los minutos y la planta, no la burocracia ────── */

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
  const [taskDecision, setTaskDecision] = useState<"pendiente" | "sigue" | "terminada">("pendiente");
  const [pendingTask, startTask] = useTransition();
  const toast = useToast();
  const plant = overview.plant;
  const stage = plant ? plant.stage : "semilla";
  const next = plant ? plant.next : nextStageInfo(0);
  const early = info.outcome === "terminada-antes";
  const discarded = info.outcome === "descartada";
  // decisión explícita sobre la tarea: solo cuando hubo tarea y la sesión contó
  const askTask = Boolean(info.cardId) && !discarded && taskDecision === "pendiente";

  function completeTask() {
    if (!info.cardId) return;
    startTask(async () => {
      let freedAt: number | null = null;
      try {
        const res = await completeCardAction(info.cardId!, true);
        freedAt = res.freedPriorityAt;
      } catch {
        toast.show({ tone: "error", message: "No se pudo completar. Inténtalo desde la tarea." });
        return;
      }
      setTaskDecision("terminada");
      toast.show({
        message: "Tarea completada ✓",
        action: {
          label: "Deshacer",
          onClick: async () => {
            try {
              await completeCardAction(info.cardId!, false, freedAt);
              setTaskDecision("pendiente");
            } catch {
              toast.show({ tone: "error", message: "No se pudo deshacer. Puedes reabrirla desde Terminadas." });
            }
          },
        },
        link: { label: "Ver en terminadas", href: "/tareas?v=terminadas" },
        duration: 8000,
      });
    });
  }

  return (
    <div className="flex flex-col items-center gap-5" data-testid="focus-summary">
      <p className="section-eyebrow flex items-center gap-1.5">
        <CheckCircle2 size={13} className="text-done" aria-hidden />
        {discarded ? "Sesión descartada" : early ? "Sesión guardada" : "Ciclo completo"}
      </p>

      <p className="font-display text-2xl md:text-3xl text-forest-deep max-w-md text-balance">
        {discarded
          ? "La sesión quedó en el registro"
          : `Guardaste ${info.creditedMinutes} minuto${info.creditedMinutes === 1 ? "" : "s"} de enfoque`}
      </p>

      <FocusPlant stage={stage} className="h-40 w-40 md:h-44 md:w-44 text-sage-deep" />

      <div className="text-sm text-stone flex flex-col gap-1 max-w-sm">
        {info.plantCompleted ? (
          <p className="text-ink-green" data-testid="focus-plant-complete">
            Tu planta está completa y se unió a tu jardín. Nace una semilla nueva. 🌿
          </p>
        ) : discarded ? (
          <p data-testid="focus-credited">Sin minutos abonados — nada se pierde sin registro.</p>
        ) : (
          <p>Tu {STAGE_NOUN[stage]} sigue creciendo.</p>
        )}
        {!discarded && (
          <p className="text-xs text-stone-soft" data-testid="focus-credited">
            {info.creditedMinutes} min de enfoque abonados a tu planta
            {next ? ` · faltan ${next.missingMinutes} min para ${STAGE_LABEL[next.key].toLowerCase()}` : ""}
          </p>
        )}
        {early && !discarded && <p className="text-xs text-stone-soft">Cuentan igual. Parar antes también es cuidar el foco.</p>}
        <p className="text-xs text-stone-soft">
          {info.cardTitle ?? "Enfoque libre"} · {STAGE_LABEL[stage]}
          {plant ? ` · ${plant.accumulatedMinutes} min acumulados` : ""}
        </p>
      </div>

      {/* Decisión explícita sobre la tarea — nunca se completa sola */}
      {askTask && (
        <div className="flex flex-col items-center gap-2" data-testid="focus-task-decision">
          <p className="text-xs text-stone">¿Y «{info.cardTitle}»?</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="btn btn-primary !py-1.5 !px-4 text-sm"
              onClick={() => setTaskDecision("sigue")}
              data-testid="focus-task-continue"
            >
              Sigue en curso
            </button>
            <button
              type="button"
              className="btn btn-secondary !py-1.5 !px-3 text-sm"
              onClick={completeTask}
              disabled={pendingTask}
              data-testid="focus-task-complete"
            >
              <CheckCircle2 size={14} aria-hidden /> La terminé
            </button>
            <button
              type="button"
              className="btn btn-ghost !py-1.5 !px-3 text-sm"
              onClick={() => {
                onBack();
                openTaskUrl(info.cardId!);
              }}
              data-testid="focus-task-open"
            >
              Abrir tarea
            </button>
          </div>
        </div>
      )}
      {taskDecision !== "pendiente" && (
        <p className="text-xs text-stone" data-testid="focus-task-decided">
          {taskDecision === "sigue" ? "La tarea sigue en curso ✓" : "Tarea completada ✓"}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className={`btn ${askTask ? "btn-secondary" : "btn-primary"} !px-7`}
          onClick={onAnother}
          data-testid="focus-another"
        >
          Otra sesión
        </button>
        <button type="button" className="btn btn-ghost" onClick={onBack} data-testid="focus-back-app">
          Volver a Mafer OS
        </button>
      </div>
    </div>
  );
}
