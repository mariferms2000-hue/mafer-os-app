"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FlaskConical, Trash2, Sun } from "lucide-react";
import { seedAlertQaAction, deleteAlertQaAction } from "@/lib/actions/maintenance";
import { useToast } from "@/components/ui/toast";

/** Panel SOLO de desarrollo para validar las alertas antiolvido sin esperar
 *  días reales. Crea datos temporales con prefijo «QA ALERTA» y los borra
 *  todos con un botón. Nunca toca datos reales. */
export function AlertQaPanel({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [pending, start] = useTransition();
  const toast = useToast();

  return (
    <section className="card p-5 mb-5 border-dashed" data-testid="alert-qa-panel">
      <h2 className="text-lg text-forest-deep mb-1 flex items-center gap-2">
        <FlaskConical size={18} className="text-olive" aria-hidden /> Pruebas de alertas antiolvido
      </h2>
      <p className="text-sm text-stone mb-3">
        Solo en desarrollo. Crea datos temporales con prefijo <strong>«QA ALERTA»</strong> que simulan los
        seis escenarios (vencida, hoy sin estimar, proyecto sin acción, Inbox +3 días, esperando +7 días,
        proyecto +14 días dormido). No modifica fechas de datos reales ni toca tus proyectos.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary text-sm"
          disabled={pending}
          data-testid="qa-seed-alerts"
          onClick={() =>
            start(async () => {
              try {
                await seedAlertQaAction();
                setCount((c) => c + 6);
                toast.show({ message: "Escenarios QA creados ✓ — revísalos en Hoy." });
              } catch {
                toast.show({ tone: "error", message: "No se pudieron crear los escenarios QA." });
              }
            })
          }
        >
          Crear escenarios de prueba
        </button>
        <Link href="/" className="btn btn-ghost text-sm">
          <Sun size={14} aria-hidden /> Abrir Hoy para revisarlos
        </Link>
        <button
          type="button"
          className="btn btn-danger text-sm"
          disabled={pending || count === 0}
          data-testid="qa-delete-alerts"
          onClick={() =>
            start(async () => {
              try {
                await deleteAlertQaAction();
                setCount(0);
                toast.show({ tone: "info", message: "Datos QA eliminados. Tus datos reales quedaron intactos." });
              } catch {
                toast.show({ tone: "error", message: "No se pudieron eliminar los datos QA." });
              }
            })
          }
        >
          <Trash2 size={14} aria-hidden /> Eliminar todos los datos QA
        </button>
      </div>
      {count > 0 && (
        <p className="text-xs text-stone-soft mt-2" data-testid="qa-count">
          Hay {count} elementos QA en la base.
        </p>
      )}
    </section>
  );
}
