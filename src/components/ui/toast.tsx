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
};

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

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      const toast: Toast = { tone: "ok", duration: 6000, ...input, id };
      setToasts((ts) => [...ts.slice(-2), toast]);
      if (toast.duration && toast.duration > 0) {
        setTimeout(() => dismiss(id), toast.duration);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="fixed z-[70] bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-md pointer-events-none"
      >
        {toasts.map((t) => {
          const tone = t.tone ?? "ok";
          const Icon = ICONS[tone];
          return (
            <div
              key={t.id}
              role="status"
              data-tone={tone}
              className="pointer-events-auto rounded-2xl border px-4 py-3 flex items-center gap-3 text-sm shadow-lift"
              style={{
                background: "var(--color-toast-bg)",
                borderColor: "var(--color-toast-border)",
                color: "var(--color-toast-fg)",
              }}
            >
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
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
