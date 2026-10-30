/* Textos del camino hacia la próxima recompensa (F3). Puros, para el Jardín y
   los toasts. */

const WORD = ["", "Una", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez"];

/** «2 de 3 tareas» */
export function pathTitle(count: number, goal: number): string {
  return `${count} de ${goal} ${goal === 1 ? "tarea" : "tareas"}`;
}

/** La frase en cursiva bajo el camino: cuánto falta, en palabras. */
export function pathHint(count: number, goal: number): string {
  const left = Math.max(0, goal - count);
  const word = WORD[left] ?? String(left);
  if (left === 0) return "Tu recompensa ya está en tu inventario.";
  if (count === 0) return `${word} ${left === 1 ? "tarea" : "tareas"} para tu próxima recompensa.`;
  return `${word} más para tu próxima recompensa.`;
}
