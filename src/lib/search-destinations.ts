/* Destinos internos que Buscar encuentra aunque no vivan en la base de datos
   (páginas-herramienta como Sueño). Se suman a los resultados de siempre con
   la misma forma.

   A diferencia del resto de Buscar (subcadena exacta sobre la base), aquí se
   ignoran acentos y mayúsculas y basta con que cada palabra buscada aparezca
   en el título o las palabras clave: «sueno», «hora de dormir» y «ciclo de
   sueño» encuentran Sueño. */

export type Destination = { title: string; sub: string; href: string; category: string; keywords: string };

export const DESTINATIONS: Destination[] = [
  {
    title: "Sueño",
    sub: "Calcula a qué hora acostarte o despertar, contando ciclos de sueño",
    href: "/sueno",
    category: "herramienta",
    keywords: "dormir despertar acostarse ciclos de sueño hora de dormir hora de despertar calculadora noche",
  },
];

/** Sin acentos ni mayúsculas: «Sueño» → «sueno». */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function matchDestinations(query: string, destinations: Destination[] = DESTINATIONS): Destination[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return destinations.filter((d) => {
    const haystack = fold(`${d.title} ${d.keywords}`);
    return words.every((w) => haystack.includes(w));
  });
}
