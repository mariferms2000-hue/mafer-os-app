"use client";

import Link from "next/link";
import { Bell, BellOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import { DEFAULT_AVISO_TIME, LEAD_OPTIONS, leadLabel } from "@/lib/avisos/logic";
import type { AvisoState } from "@/lib/avisos/sync";

/**
 * «🔔 Avisarme» en el formulario de una tarea. Siempre opcional: poner fecha u
 * hora NO lo enciende. Al encenderlo en una tarea sin hora se propone 9:00 (se
 * puede cambiar en el campo de hora). Envía `aviso` (1/0) y `avisoLead`.
 */
export function AvisoFields({
  on,
  onToggle,
  lead,
  onLead,
  dueDate,
  startTime,
  onProposeTime,
  proposedTime,
  state,
  legacy,
  done,
}: {
  on: boolean;
  onToggle: (next: boolean) => void;
  lead: number;
  onLead: (minutes: number) => void;
  dueDate: string;
  startTime: string;
  /** se llama al encender sin hora: el formulario pone 9:00 en su campo */
  onProposeTime: (hhmm: string) => void;
  proposedTime: boolean;
  state?: AvisoState;
  /** la tarea tiene un recordatorio del sistema anterior: no se ofrece el nuevo */
  legacy?: boolean;
  done?: boolean;
}) {
  if (legacy) {
    return (
      <div className="rounded-xl border border-beige p-3 text-sm text-stone" data-testid="aviso-legacy">
        <p className="flex items-center gap-1.5 text-charcoal">
          <Bell size={14} aria-hidden /> Recordatorio del sistema anterior
        </p>
        <p className="mt-1">
          Vive en el calendario «Mafer OS». Para pasarlo a «Mafer OS · Avisos» revísalo en{" "}
          <Link href="/ajustes#avisos" className="text-forest underline underline-offset-4">Ajustes → Avisos</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="aviso-fields">
      <input type="hidden" name="aviso" value={on ? "1" : "0"} />
      {on && <input type="hidden" name="avisoLead" value={String(lead)} />}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className={`chip !min-h-9 self-start transition-colors ${on ? "chip-on" : "hover:bg-sand"}`}
        data-testid="aviso-switch"
        onClick={() => {
          const next = !on;
          onToggle(next);
          if (next && !startTime) onProposeTime(DEFAULT_AVISO_TIME);
        }}
      >
        {on ? <Bell size={14} aria-hidden /> : <BellOff size={14} aria-hidden />}
        {on ? "Avisarme: sí" : "Avisarme"}
      </button>

      {on && (
        <>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="¿Cuándo avisarte?" data-testid="aviso-lead">
            {LEAD_OPTIONS.map((o) => (
              <button
                key={o.minutes}
                type="button"
                role="radio"
                aria-checked={lead === o.minutes}
                className={`chip !min-h-8 transition-colors ${lead === o.minutes ? "chip-on-alt" : "hover:bg-sand"}`}
                onClick={() => onLead(o.minutes)}
              >
                {o.label}
              </button>
            ))}
          </div>
          {!dueDate && (
            <p className="text-xs text-blocked" data-testid="aviso-needs-date">Para avisarte necesito una fecha.</p>
          )}
          {dueDate && !startTime && (
            <p className="text-xs text-blocked" data-testid="aviso-needs-time">Para avisarte necesito una hora.</p>
          )}
          {proposedTime && startTime === DEFAULT_AVISO_TIME && (
            <p className="text-xs text-stone" data-testid="aviso-proposed-time">
              Te propuse las 9:00. Puedes cambiar la hora arriba.
            </p>
          )}
          <p className="text-xs text-stone-soft">
            Llega como notificación del calendario «Mafer OS · Avisos» ({leadLabel(lead).toLowerCase()}).
          </p>
        </>
      )}

      {state && on && !done && (
        state.error ? (
          <p className="text-xs text-blocked flex items-start gap-1.5" data-testid="aviso-state-error">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Aviso sin sincronizar: {state.error} Al guardar se vuelve a intentar, o usa{" "}
              <Link href="/ajustes#avisos" className="underline underline-offset-4">Reparar avisos</Link>.
            </span>
          </p>
        ) : state.synced ? (
          <p className="text-xs text-done flex items-center gap-1.5" data-testid="aviso-state-ok">
            <CheckCircle2 size={13} aria-hidden /> Aviso en Google Calendar.
          </p>
        ) : null
      )}
    </div>
  );
}

/** Validación al enviar: devuelve el mensaje a mostrar, o null si se puede guardar. */
export function avisoFormProblem(fd: FormData): string | null {
  if (fd.get("aviso") !== "1") return null;
  if (!fd.get("dueDate")) return "Para avisarte necesito una fecha. Ponle fecha o apaga «Avisarme».";
  if (!fd.get("startTime")) return "Para avisarte necesito una hora. Ponle hora o apaga «Avisarme».";
  return null;
}
