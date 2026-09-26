import { addDays } from "@/lib/tz";

/* Eventos de varios días («cuidar a la perrita de martes a domingo»): un solo
 * registro con `repeatUntil` que se repite CADA DÍA desde `date` hasta
 * `repeatUntil`, ambos incluidos. Lógica pura: se prueba en
 * tests/event-repeat.test.ts. */

/** Tope de seguridad: un evento no se repite más de un año. */
export const MAX_DIAS_REPETICION = 366;

type ConRepeticion = { date: string; repeatUntil?: string | null };

/** La fecha final normalizada, o null si el evento es de un solo día. */
export function finRepeticion(e: ConRepeticion): string | null {
  if (!e.repeatUntil || e.repeatUntil <= e.date) return null;
  const tope = addDays(e.date, MAX_DIAS_REPETICION - 1);
  return e.repeatUntil > tope ? tope : e.repeatUntil;
}

/** Cuántos días ocupa (1 si no se repite). */
export function diasDeRepeticion(e: ConRepeticion): number {
  const fin = finRepeticion(e);
  if (!fin) return 1;
  let n = 1;
  for (let d = e.date; d < fin; d = addDays(d, 1)) n++;
  return n;
}

/** ¿El evento aparece el día `d`? */
export function ocurreEl(e: ConRepeticion, d: string): boolean {
  const fin = finRepeticion(e) ?? e.date;
  return d >= e.date && d <= fin;
}

/** Todos los días en que aparece el evento, en orden. */
export function fechasDelEvento(e: ConRepeticion): string[] {
  const fin = finRepeticion(e) ?? e.date;
  const out: string[] = [];
  for (let d = e.date; d <= fin; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Lee «repetir hasta» de un formulario: solo cuenta si la casilla está
 *  marcada y la fecha es posterior al inicio; si no, el evento es de un día. */
export function repeatUntilDeFormulario(fd: FormData, date: string): string | null {
  if (fd.get("repeat") !== "on") return null;
  const hasta = String(fd.get("repeatUntil") ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(hasta) && hasta > date ? hasta : null;
}
