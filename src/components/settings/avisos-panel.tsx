"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, CheckCircle2, Wrench, Search, FlaskConical } from "lucide-react";
import {
  activateAvisosAction,
  applyAvisosReviewAction,
  createTestAvisoAction,
  deactivateAvisosAction,
  deleteTestAvisoAction,
  repairAvisosAction,
  reviewAvisosAction,
  setSimulatedFailureAction,
} from "@/lib/actions/avisos";
import type { AvisosOverview, ReviewResult, ApplyOutcome } from "@/lib/avisos/sync";
import type { CalendarEventLite } from "@/lib/avisos/logic";
import { useToast } from "@/components/ui/toast";
import { TIMEZONE } from "@/lib/tz";

type SimEvent = CalendarEventLite & { calendarId: string; lead: number | null };

const fmt = (iso: string | null) => {
  if (!iso) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-MX", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  const d = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso) ? new Date(iso) : new Date(`${iso}-06:00`);
  return d.toLocaleString("es-MX", { timeZone: TIMEZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

export function AvisosPanel({ o, simEvents }: { o: AvisosOverview; simEvents: SimEvent[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const [iphone, setIphone] = useState(false);
  const [alexa, setAlexa] = useState<"lee" | "no-lee" | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [moves, setMoves] = useState<Set<string>>(new Set());
  const [ghosts, setGhosts] = useState<Set<string>>(new Set());
  const [confirmApply, setConfirmApply] = useState(false);
  const [outcome, setOutcome] = useState<ApplyOutcome | null>(null);
  const [simFail, setSimFail] = useState(o.simulatedFailure);

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      try {
        await fn();
      } catch {
        toast.show({ tone: "error", message: "No se pudo completar la acción. Inténtalo de nuevo." });
      }
      router.refresh();
    });

  const toggle = (set: Set<string>, id: string, update: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
    setConfirmApply(false);
  };

  if (!o.tableReady) {
    return (
      <p className="text-sm text-stone" data-testid="avisos-no-table">
        La base de datos todavía no está preparada para los avisos. Los recordatorios siguen funcionando como antes.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5 text-sm" data-testid="avisos-panel">
      {o.mode === "simulado" && (
        <p className="rounded-xl border border-beige bg-sand/40 p-3 text-stone flex gap-2" data-testid="avisos-simulado">
          <FlaskConical size={15} className="mt-0.5 shrink-0 text-sage-deep" aria-hidden />
          <span>
            <strong className="text-charcoal">Modo simulado.</strong> Aquí no hay conexión con Google: los avisos se
            guardan en una lista de prueba (abajo) para revisar el flujo completo sin tocar tus calendarios.
          </span>
        </p>
      )}

      {/* Estado */}
      <ul className="flex flex-col gap-1 text-stone" data-testid="avisos-status">
        <li>Google Calendar: {o.connected ? <span className="text-done">conectado ✓</span> : <span className="text-blocked">no conectado</span>}</li>
        <li>Calendario «Mafer OS · Avisos»: {o.avisosCalendar ? <span className="text-done">creado ✓</span> : "se crea con el aviso de prueba"}</li>
        <li>
          Avisos de tareas:{" "}
          {o.active ? (
            <span className="text-done" data-testid="avisos-active">activos ✓</span>
          ) : (
            <span data-testid="avisos-inactive">sin activar (las tareas usan el recordatorio anterior)</span>
          )}
          {o.active && ` · ${o.synced} de ${o.total} en Google`}
        </li>
      </ul>

      {/* Paso 1: prueba real */}
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold text-ink-green">1. Aviso de prueba</h3>
        <p className="text-stone">
          Crea un evento en «Mafer OS · Avisos» dentro de 5 minutos, con alerta a la hora. Sirve para comprobar que la
          notificación llega al iPhone y qué hace Alexa con los avisos.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending || !o.connected}
            data-testid="avisos-test-create"
            onClick={() =>
              run(async () => {
                const r = await createTestAvisoAction();
                toast.show(r.ok ? { message: `Aviso de prueba creado para las ${fmt(r.at ?? null)} ✓` } : { tone: "warn", message: r.error });
              })
            }
          >
            <Bell size={15} aria-hidden /> Enviar aviso de prueba
          </button>
          {o.test && (
            <>
              <span className="chip" data-testid="avisos-test-at">Prueba: {fmt(o.test.at)}</span>
              <button
                type="button"
                className="btn btn-ghost text-xs"
                disabled={pending}
                data-testid="avisos-test-delete"
                onClick={() =>
                  run(async () => {
                    const r = await deleteTestAvisoAction();
                    toast.show(r.ok ? { tone: "info", message: "Aviso de prueba borrado." } : { tone: "warn", message: r.error });
                  })
                }
              >
                Borrar aviso de prueba
              </button>
            </>
          )}
        </div>
        <details className="text-stone">
          <summary className="cursor-pointer text-forest underline underline-offset-4">Qué revisar en el iPhone y en Alexa</summary>
          <ol className="list-decimal ml-5 mt-2 flex flex-col gap-1">
            <li><strong>Calendario de Apple:</strong> en Safari abre <code className="bg-beige px-1 rounded">calendar.google.com/calendar/syncselect</code>, marca «Mafer OS · Avisos» y guarda. Luego, en la app Calendario → Calendarios, comprueba que esté visible.</li>
            <li><strong>App de Google Calendar</strong> (si la usas): Ajustes → «Mafer OS · Avisos» → notificaciones activadas.</li>
            <li>Espera la hora del aviso de prueba con el iPhone bloqueado y sin modo Concentración.</li>
            <li><strong>Alexa:</strong> pregúntale «¿Qué tengo hoy?». Si quieres que lea tus avisos, «Mafer OS · Avisos» debe estar marcado en la app de Alexa → Calendario → Google; si no, desmárcalo ahí.</li>
          </ol>
        </details>
      </div>

      {/* Paso 2: activar */}
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold text-ink-green">2. Activar los avisos de tareas</h3>
        {o.active ? (
          confirmOff ? (
            <div className="flex flex-wrap items-center gap-2" data-testid="avisos-off-confirm">
              <span className="text-stone">Se quitarán de Google los avisos creados y las tareas volverán al recordatorio anterior. ¿Desactivar?</span>
              <button type="button" className="btn btn-danger !py-1.5 text-xs" disabled={pending} data-testid="avisos-off-yes"
                onClick={() => run(async () => {
                  const r = await deactivateAvisosAction();
                  setConfirmOff(false);
                  toast.show(r.ok ? { tone: "info", message: "Avisos desactivados." } : { tone: "warn", message: r.error });
                })}>
                Sí, desactivar
              </button>
              <button type="button" className="btn btn-ghost !py-1.5 text-xs" onClick={() => setConfirmOff(false)}>No</button>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost text-xs self-start" onClick={() => setConfirmOff(true)} data-testid="avisos-off">
              Desactivar avisos
            </button>
          )
        ) : (
          <>
            <label className="flex items-start gap-2 text-stone">
              <input type="checkbox" className="h-4 w-4 mt-0.5" checked={iphone} onChange={(e) => setIphone(e.target.checked)} data-testid="avisos-check-iphone" />
              Recibí la notificación del aviso de prueba en mi iPhone.
            </label>
            {/* Alexa es una preferencia, no un requisito para activar */}
            <div className="flex flex-col gap-1.5 text-stone" data-testid="avisos-alexa">
              <span>¿Quieres que Alexa lea tus avisos? (opcional)</span>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Alexa y los avisos">
                {([["lee", "Sí, que los lea"], ["no-lee", "No, solo mis compromisos"]] as const).map(([v, label]) => (
                  <button key={v} type="button" role="radio" aria-checked={alexa === v}
                    className={`chip !min-h-8 transition-colors ${alexa === v ? "chip-on-alt" : "hover:bg-sand"}`}
                    onClick={() => setAlexa(v)}>
                    {label}
                  </button>
                ))}
              </div>
              {alexa === "lee" && (
                <p className="text-xs" data-testid="avisos-alexa-lee">Deja «Mafer OS · Avisos» marcado en la app de Alexa → Calendario → Google.</p>
              )}
              {alexa === "no-lee" && (
                <p className="text-xs" data-testid="avisos-alexa-no-lee">En la app de Alexa → Calendario → Google, desmarca «Mafer OS · Avisos». Tus compromisos de «Mafer OS» siguen igual.</p>
              )}
            </div>
            <button
              type="button"
              className="btn btn-primary self-start"
              disabled={pending || !iphone}
              data-testid="avisos-activate"
              onClick={() =>
                run(async () => {
                  const r = await activateAvisosAction({ iphone });
                  toast.show(r.ok ? { message: "Avisos activados ✓ Ya puedes usar «🔔 Avisarme» en tus tareas." } : { tone: "warn", message: r.error });
                })
              }
            >
              Activar avisos
            </button>
          </>
        )}
      </div>

      {/* Fallos */}
      {o.active && (
        <div className="flex flex-col gap-2" data-testid="avisos-failures">
          <h3 className="font-semibold text-ink-green">Avisos con fallos</h3>
          {o.failing.length === 0 ? (
            <p className="text-done flex items-center gap-1.5"><CheckCircle2 size={14} aria-hidden /> Ninguno: todo está sincronizado.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {o.failing.map((f) => (
                <li key={f.cardId} className="flex items-start gap-1.5 text-blocked" data-testid="avisos-failure">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                  <span><strong>{f.title}</strong>: {f.error}</span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="btn btn-secondary self-start"
            disabled={pending}
            data-testid="avisos-repair"
            onClick={() =>
              run(async () => {
                const r = await repairAvisosAction();
                toast.show(
                  r.fallidos
                    ? { tone: "warn", message: `Quedaron ${r.fallidos} avisos sin sincronizar: ${r.error}` }
                    : { message: `Avisos reparados ✓ (${r.total} revisados)` }
                );
              })
            }
          >
            <Wrench size={15} aria-hidden /> Reparar avisos
          </button>
        </div>
      )}

      {/* Revisión de lo existente */}
      {o.active && (
        <div className="flex flex-col gap-2" data-testid="avisos-review">
          <h3 className="font-semibold text-ink-green">3. Recordatorios anteriores y eventos fantasma</h3>
          <p className="text-stone">
            Revisa qué hay hoy en tus calendarios. Revisar no cambia nada: solo se aplica lo que marques y confirmes.
            Los compromisos y los eventos que no son avisos de tareas nunca aparecen aquí.
          </p>
          <button
            type="button"
            className="btn btn-secondary self-start"
            disabled={pending}
            data-testid="avisos-review-load"
            onClick={() =>
              start(async () => {
                setOutcome(null);
                setConfirmApply(false);
                setMoves(new Set());
                setGhosts(new Set());
                try {
                  setReview(await reviewAvisosAction());
                } catch {
                  toast.show({ tone: "error", message: "No se pudo revisar. Inténtalo de nuevo." });
                }
              })
            }
          >
            <Search size={15} aria-hidden /> Revisar avisos existentes
          </button>

          {review && !review.ok && <p className="text-blocked" data-testid="avisos-review-error">{review.error}</p>}
          {review && review.ok && (
            <div className="flex flex-col gap-4 border-t border-beige pt-3" data-testid="avisos-review-result">
              <p className="text-stone" data-testid="avisos-review-stats">
                Cómo están guardados hoy: {review.stats.legacyTimed} tareas con recordatorio «con hora»,{" "}
                {review.stats.legacyAllDay} «todo el día» ({review.stats.legacyWithGoogleId} vinculadas a un evento de Google) y{" "}
                {review.stats.avisos} con «Avisarme». Se dejan intactos {review.untouched.maferOs} eventos de «Mafer OS»
                {review.calendars.avisos ? ` y ${review.untouched.avisos} de «Mafer OS · Avisos»` : ""}.
              </p>

              <section>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h4 className="font-semibold text-charcoal">Recordatorios que se moverán ({review.moves.length})</h4>
                  {review.moves.length > 0 && (
                    <button type="button" className="text-xs text-forest underline underline-offset-4" data-testid="avisos-moves-all"
                      onClick={() => { setMoves(new Set(review.moves.map((m) => m.cardId))); setConfirmApply(false); }}>
                      Marcar todos
                    </button>
                  )}
                </div>
                {review.moves.length === 0 ? (
                  <p className="text-stone-soft">Ninguno.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {review.moves.map((m) => (
                      <li key={m.cardId}>
                        <label className="flex items-start gap-2" data-testid="avisos-move">
                          <input type="checkbox" className="h-4 w-4 mt-0.5" checked={moves.has(m.cardId)} onChange={() => toggle(moves, m.cardId, setMoves)} />
                          <span>
                            <strong className="text-charcoal">{m.title}</strong>
                            <span className="text-stone"> · {m.dueDate ? fmt(m.dueDate) : "sin fecha"}{m.startTime ? `, ${m.startTime}` : ""}</span>
                            <span className="block text-xs text-stone">
                              {m.paused
                                ? "Fecha pasada o sin fecha: no se crea aviso nuevo hasta que la reprogrames."
                                : `Nuevo aviso en «Mafer OS · Avisos», a la hora${m.setsTime ? " (la tarea no tiene hora: se le pondrá 9:00)" : ""}.`}{" "}
                              {m.oldEvent
                                ? `Se borrará su evento actual de «Mafer OS» («${m.oldEvent.summary}», ${fmt(m.oldEvent.start)}).`
                                : "No tiene evento en «Mafer OS»: no se borra nada."}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h4 className="font-semibold text-charcoal">Eventos fantasma que se eliminarán ({review.ghosts.length})</h4>
                  {review.ghosts.length > 0 && (
                    <button type="button" className="text-xs text-forest underline underline-offset-4" data-testid="avisos-ghosts-all"
                      onClick={() => { setGhosts(new Set(review.ghosts.map((g) => g.event.id))); setConfirmApply(false); }}>
                      Marcar todos
                    </button>
                  )}
                </div>
                <p className="text-xs text-stone-soft mb-1.5">
                  Solo aparecen eventos que la app marcó como aviso de una tarea concreta.
                </p>
                {review.ghosts.length === 0 ? (
                  <p className="text-stone-soft">Ninguno.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {review.ghosts.map((g) => (
                      <li key={g.event.id}>
                        <label className="flex items-start gap-2" data-testid="avisos-ghost">
                          <input type="checkbox" className="h-4 w-4 mt-0.5" checked={ghosts.has(g.event.id)} onChange={() => toggle(ghosts, g.event.id, setGhosts)} />
                          <span>
                            <strong className="text-charcoal">{g.event.summary}</strong>
                            <span className="text-stone"> · {fmt(g.event.start)} · calendario «{g.calendar === "mafer-os" ? "Mafer OS" : "Mafer OS · Avisos"}»</span>
                            <span className="block text-xs text-stone">
                              {g.reason}
                              {g.cardTitle ? ` Tarea: «${g.cardTitle}».` : ""}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {(moves.size > 0 || ghosts.size > 0) &&
                (confirmApply ? (
                  <div className="rounded-xl border border-beige p-3 flex flex-col gap-2" data-testid="avisos-apply-confirm">
                    <p className="text-charcoal">
                      Se moverán {moves.size} recordatorios y se eliminarán de Google {ghosts.size} eventos fantasma, más los{" "}
                      eventos anteriores de los recordatorios movidos. No se toca nada más. ¿Confirmas?
                    </p>
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-danger !py-1.5 text-xs" disabled={pending} data-testid="avisos-apply-yes"
                        onClick={() =>
                          start(async () => {
                            try {
                              const r = await applyAvisosReviewAction({ moveCardIds: [...moves], ghostEventIds: [...ghosts] });
                              setOutcome(r);
                              setReview(null);
                              toast.show(r.errors.length
                                ? { tone: "warn", message: `Aplicado con ${r.errors.length} problemas: revisa el detalle.` }
                                : { message: `Listo ✓ ${r.moved} movidos, ${r.deleted} eventos eliminados.` });
                            } catch {
                              toast.show({ tone: "error", message: "No se pudo aplicar. No se cambió nada más." });
                            }
                            router.refresh();
                          })
                        }>
                        Sí, aplicar
                      </button>
                      <button type="button" className="btn btn-ghost !py-1.5 text-xs" onClick={() => setConfirmApply(false)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn btn-primary self-start" onClick={() => setConfirmApply(true)} data-testid="avisos-apply">
                    Aplicar lo seleccionado
                  </button>
                ))}
            </div>
          )}

          {outcome && (
            <div className="border-t border-beige pt-3 text-stone flex flex-col gap-1" data-testid="avisos-outcome">
              <p className="text-charcoal">Resultado: {outcome.moved} recordatorios movidos, {outcome.deleted} eventos eliminados.</p>
              {outcome.skipped.map((s) => <p key={s}>Saltado: {s}</p>)}
              {outcome.errors.map((s) => <p key={s} className="text-blocked">Problema: {s}</p>)}
            </div>
          )}
        </div>
      )}

      {/* Simulador */}
      {o.mode === "simulado" && (
        <div className="flex flex-col gap-2 border-t border-beige pt-3" data-testid="avisos-sim">
          <h3 className="font-semibold text-ink-green">Calendarios simulados</h3>
          <label className="flex items-center gap-2 text-stone">
            <input type="checkbox" className="h-4 w-4" checked={simFail} data-testid="avisos-sim-fail"
              onChange={(e) => {
                const v = e.target.checked;
                setSimFail(v);
                run(() => setSimulatedFailureAction(v));
              }} />
            Simular que Google falla (para probar los avisos de error y «Reparar»)
          </label>
          {simEvents.length === 0 ? (
            <p className="text-stone-soft">No hay eventos simulados.</p>
          ) : (
            <ul className="flex flex-col gap-1" data-testid="avisos-sim-list">
              {simEvents.map((e) => (
                <li key={`${e.calendarId}:${e.id}`} className="text-stone" data-testid="avisos-sim-event">
                  <span className="chip !min-h-6 text-xs mr-1.5">{e.calendarId === "sim-avisos" ? "Mafer OS · Avisos" : "Mafer OS"}</span>
                  {e.summary} · {fmt(e.start)}
                  {e.lead !== null && e.aviso ? ` · alerta ${e.lead === 0 ? "a la hora" : `${e.lead} min antes`}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
