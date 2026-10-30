"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, AlertTriangle, CircleX, X } from "lucide-react";
import { GardenPath } from "@/components/progress/garden-path";
import { REWARD_ICON } from "@/components/progress/reward-icon";
import type { RewardItem } from "@/lib/progress/logic";

export type Toast = {
  id: number;
  message: string;
  /** ok = éxito · info = información · warn = advertencia · error = falló algo */
  tone?: "ok" | "info" | "warn" | "error";
  /** Acción principal, p. ej. «Deshacer». */
  action?: { label: string; onClick: () => void | Promise<void> };
  /** Acción secundaria, p. ej. «Elegir reemplazo». */
  secondAction?: { label: string; onClick: () => void | Promise<void> };
  /** Enlace secundario, p. ej. «Ver en terminadas». */
  link?: { label: string; href: string };
  duration?: number;
  /** Progreso del jardín bajo el mensaje (1 y 2 de 3): el camino en miniatura,
   *  con la hoja `grow` brotando. */
  progress?: { count: number; goal: number; grow?: number | null };
  /** Recompensa ganada: en lugar del aviso de sistema, la tarjeta de
   *  recompensa. `message` queda arriba, pequeño (confirma la tarea). */
  reward?: { item: RewardItem; label: string; goal: number };
};

/** La tarjeta de recompensa dura más y no se cierra con el cursor encima. */
const REWARD_DURATION = 10000;
const RESUME_AFTER_HOVER = 4000;

type ToastInput = Omit<Toast, "id">;

const ToastContext = createContext<{ show: (t: ToastInput) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

const ICONS = { ok: CheckCircle2, info: Info, warn: AlertTriangle, error: CircleX };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const schedule = useCallback(
    (id: number, ms: number) => {
      clearTimeout(timers.current.get(id));
      timers.current.set(id, setTimeout(() => dismiss(id), ms));
    },
    [dismiss]
  );

  const show = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      const toast: Toast = { tone: "ok", duration: 6000, ...input, id };
      if (toast.reward) toast.duration = Math.max(toast.duration ?? 0, REWARD_DURATION);
      setToasts((ts) => [...ts.slice(-2), toast]);
      if (toast.duration && toast.duration > 0) schedule(id, toast.duration);
    },
    [schedule]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="fixed z-[70] bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-md pointer-events-none"
      >
        {toasts.map((t) => {
          if (t.reward) {
            return (
              <RewardCard
                key={t.id}
                toast={t}
                onDismiss={() => dismiss(t.id)}
                onPause={() => clearTimeout(timers.current.get(t.id))}
                onResume={() => schedule(t.id, RESUME_AFTER_HOVER)}
              />
            );
          }
          const tone = t.tone ?? "ok";
          const Icon = ICONS[tone];
          return (
            <div
              key={t.id}
              role="status"
              data-tone={tone}
              className="pointer-events-auto rounded-2xl border px-4 py-3 text-sm shadow-lift"
              style={{
                background: "var(--color-toast-bg)",
                borderColor: "var(--color-toast-border)",
                color: "var(--color-toast-fg)",
              }}
            >
              <div className="flex items-center gap-3">
                <Icon size={17} aria-hidden style={{ color: `var(--color-toast-${tone})` }} className="shrink-0" />
                <span className="flex-1">{t.message}</span>
                {t.action && (
                  <button
                    type="button"
                    className="font-semibold underline underline-offset-4 hover:opacity-80 shrink-0"
                    onClick={async () => {
                      dismiss(t.id);
                      await t.action!.onClick();
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
                {t.secondAction && (
                  <button
                    type="button"
                    className="font-semibold underline underline-offset-4 hover:opacity-80 shrink-0"
                    onClick={async () => {
                      dismiss(t.id);
                      await t.secondAction!.onClick();
                    }}
                  >
                    {t.secondAction.label}
                  </button>
                )}
                {t.link && (
                  <a
                    href={t.link.href}
                    className="underline underline-offset-4 hover:opacity-80 shrink-0"
                    style={{ color: "var(--color-toast-muted)" }}
                  >
                    {t.link.label}
                  </a>
                )}
                <button
                  type="button"
                  aria-label="Cerrar aviso"
                  className="opacity-70 hover:opacity-100 shrink-0"
                  onClick={() => dismiss(t.id)}
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
              {/* progreso del jardín: su propia fila, alineada con el mensaje */}
              {t.progress && (
                <div
                  className="mt-1.5 pl-[29px] flex items-center gap-2.5 text-xs whitespace-nowrap"
                  style={{ color: "var(--color-toast-muted)" }}
                  data-testid="toast-progress"
                >
                  <span>Progreso del jardín</span>
                  <GardenPath
                    count={t.progress.count}
                    goal={t.progress.goal}
                    grow={t.progress.grow ?? null}
                    palette="toast"
                    weight={2.2}
                    className="w-20 h-auto shrink-0"
                    testid="toast-path"
                  />
                  <span className="tabular-nums">
                    {t.progress.count} de {t.progress.goal}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** La recompensa (F3): una tarjeta en el tono claro de Mafer OS —no el aviso
 *  oscuro de sistema— con el ícono del recurso como protagonista. Aparece
 *  donde los toasts: no oscurece la pantalla, no roba el foco, no bloquea. */
function RewardCard({
  toast: t,
  onDismiss,
  onPause,
  onResume,
}: {
  toast: Toast;
  onDismiss: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const reward = t.reward!;
  const Icon = REWARD_ICON[reward.item];
  return (
    <div
      role="status"
      data-tone="reward"
      data-testid="reward-card"
      className="pointer-events-auto card card-raised reward-card-enter !border-border-focus/50 p-4 pr-3 flex items-start gap-4 text-sm"
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={onResume}
    >
      <span className="relative h-14 w-14 shrink-0" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-sage-soft reward-halo" />
        <span className="relative h-14 w-14 rounded-full bg-sage-soft text-forest flex items-center justify-center reward-icon-pulse">
          <Icon size={28} strokeWidth={1.5} />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-stone">{t.message}</p>
        <p className="font-display text-xl leading-tight text-forest-deep mt-0.5" data-testid="reward-card-title">
          Ganaste {reward.label}
        </p>
        <p className="text-sm text-stone mt-0.5">Ya está en tus recompensas del jardín.</p>
        <GardenPath
          count={reward.goal}
          goal={reward.goal}
          grow={reward.goal - 1}
          weight={1.8}
          className="w-32 h-auto mt-2"
          testid="reward-card-path"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
          {t.link && (
            <a href={t.link.href} className="btn btn-primary !py-1.5 !px-3.5 text-sm" data-testid="reward-card-garden">
              {t.link.label}
            </a>
          )}
          {t.action && (
            <button
              type="button"
              className="text-sm text-stone underline underline-offset-4 hover:text-charcoal"
              onClick={async () => {
                onDismiss();
                await t.action!.onClick();
              }}
            >
              {t.action.label}
            </button>
          )}
          {t.secondAction && (
            <button
              type="button"
              className="text-sm text-stone underline underline-offset-4 hover:text-charcoal"
              onClick={async () => {
                onDismiss();
                await t.secondAction!.onClick();
              }}
            >
              {t.secondAction.label}
            </button>
          )}
        </div>
      </div>
      <button type="button" aria-label="Cerrar aviso" className="text-stone opacity-70 hover:opacity-100 shrink-0" onClick={onDismiss}>
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
