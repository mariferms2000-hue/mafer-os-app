import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/* `/privacidad` tiene que seguir siendo pública.
 *
 * Google solo deja publicar la app de OAuth («En producción») si la política de
 * privacidad se puede leer SIN iniciar sesión. Si alguien la saca de la lista
 * PUBLIC de src/proxy.ts, Google deja de aceptarla y la app cae a modo «Prueba»,
 * donde los tokens caducan cada 7 días y hay que reconectar el calendario cada
 * semana. Es una regresión silenciosa y carísima de diagnosticar: la app se ve
 * perfectamente bien: solo empieza a pedir reconexión.
 *
 * Se lee el archivo como texto a propósito: importar src/proxy.ts arrastraría el
 * runtime de Next, y lo que se quiere fijar aquí es la CONFIGURACIÓN, no el
 * comportamiento. */

const proxySrc = readFileSync(
  fileURLToPath(new URL("../src/proxy.ts", import.meta.url)),
  "utf8"
);

/** El arreglo literal asignado a PUBLIC, ya troceado en rutas. */
function rutasPublicas(): string[] {
  const m = proxySrc.match(/const PUBLIC\s*=\s*\[([^\]]*)\]/);
  if (!m) throw new Error("No encontré la lista PUBLIC en src/proxy.ts");
  return [...m[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((x) => x[1]);
}

describe("rutas públicas del proxy", () => {
  it("mantiene /privacidad accesible sin sesión (lo exige Google para publicar OAuth)", () => {
    expect(rutasPublicas()).toContain("/privacidad");
  });

  it("sigue dejando entrar a /login, o nadie podría iniciar sesión", () => {
    expect(rutasPublicas()).toContain("/login");
  });

  it("no abre la app entera por accidente", () => {
    // Una ruta vacía o "/" en la lista haría pública toda la app, porque el
    // proxy compara con startsWith.
    for (const ruta of rutasPublicas()) {
      expect(ruta).not.toBe("");
      expect(ruta).not.toBe("/");
    }
  });
});
