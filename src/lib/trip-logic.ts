/** Lógica pura de fechas de viaje (sin acceso a DB): rango inclusivo en
 *  ambos extremos, misma convención YYYY-MM-DD que el resto del calendario. */

export function isValidTripRange(startDate: string, endDate: string): boolean {
  return !!startDate && !!endDate && endDate >= startDate;
}

export function isTripActiveOn(trip: { startDate: string; endDate: string }, date: string): boolean {
  return date >= trip.startDate && date <= trip.endDate;
}

/** Columnas (0-6) de una semana en las que el viaje aparece, o null si no
 *  toca ninguna. `week` admite celdas `null` (relleno fuera de mes). */
export function tripWeekOverlap(
  week: (string | null)[],
  trip: { startDate: string; endDate: string }
): { startCol: number; endCol: number } | null {
  let startCol = -1;
  let endCol = -1;
  for (let i = 0; i < week.length; i++) {
    const d = week[i];
    if (d && isTripActiveOn(trip, d)) {
      if (startCol === -1) startCol = i;
      endCol = i;
    }
  }
  return startCol === -1 ? null : { startCol, endCol };
}
