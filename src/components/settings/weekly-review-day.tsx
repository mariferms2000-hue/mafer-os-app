"use client";

import { useTransition } from "react";
import { setWeeklyReviewDayAction } from "@/lib/actions/reviews";
import { useToast } from "@/components/ui/toast";

const DIAS = [
  { v: "", label: "Cualquier día" },
  { v: "1", label: "Lunes" },
  { v: "2", label: "Martes" },
  { v: "3", label: "Miércoles" },
  { v: "4", label: "Jueves" },
  { v: "5", label: "Viernes" },
  { v: "6", label: "Sábado" },
  { v: "0", label: "Domingo" },
];

/** Día preferido para sugerir la revisión semanal (solo avisos dentro de la app). */
export function WeeklyReviewDay({ current }: { current: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div>
      <label className="label" htmlFor="weekly-day">Día preferido para la revisión semanal</label>
      <select
        id="weekly-day"
        className="select !w-auto"
        defaultValue={current}
        disabled={pending}
        data-testid="weekly-day-select"
        onChange={(e) =>
          start(async () => {
            await setWeeklyReviewDayAction(e.target.value);
            toast.show({ message: "Preferencia guardada ✓" });
          })
        }
      >
        {DIAS.map((d) => (
          <option key={d.v} value={d.v}>{d.label}</option>
        ))}
      </select>
      <p className="text-xs text-stone-soft mt-1">
        Solo cambia cuándo se sugiere en la app — sin notificaciones externas.
      </p>
    </div>
  );
}
