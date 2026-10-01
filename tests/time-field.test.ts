import { describe, it, expect } from "vitest";
import {
  typeIntoSegment,
  nextSegmentText,
  stepSegment,
  splitTime,
  joinTime,
  withSegment,
  pad2,
  BUTTON_STEP,
} from "../src/lib/time-field";

/** Simula teclas en un segmento recién enfocado, como lo hace TimeField:
 *  nextSegmentText arma el texto y typeIntoSegment lo interpreta. */
function typeKeys(seg: "h" | "m", keys: string) {
  let text = "";
  let r = typeIntoSegment(seg, text);
  for (const k of keys) {
    text = nextSegmentText(text, { inputType: "insertText", data: k, value: "" });
    r = typeIntoSegment(seg, text);
    text = r.text;
  }
  return r;
}

describe("typeIntoSegment — hora (00–23)", () => {
  it("«23» es válida y se aplica al instante", () => {
    expect(typeIntoSegment("h", "23")).toEqual({ text: "23", value: 23, complete: true, immediate: true });
  });

  it("«24» se ve tal cual como borrador, pero no es un valor: nada cambia", () => {
    expect(typeIntoSegment("h", "24")).toEqual({ text: "24", value: null, complete: false, immediate: false });
    expect(typeKeys("h", "24")).toMatchObject({ text: "24", value: null });
  });

  it("«7» vale 7 y está completa (salta a minutos), pero se aplica al salir: 07", () => {
    expect(typeIntoSegment("h", "7")).toEqual({ text: "7", value: 7, complete: true, immediate: false });
    expect(pad2(7)).toBe("07");
  });

  it("«2», «0» y «1» esperan al segundo dígito", () => {
    for (const d of ["0", "1", "2"]) {
      expect(typeIntoSegment("h", d)).toMatchObject({ value: Number(d), complete: false, immediate: false });
    }
  });

  it("«00» es medianoche", () => {
    expect(typeIntoSegment("h", "00")).toMatchObject({ value: 0, immediate: true });
  });

  it("vacío no es un valor (borrar para escribir otro)", () => {
    expect(typeIntoSegment("h", "")).toEqual({ text: "", value: null, complete: false, immediate: false });
  });

  it("ignora letras y signos", () => {
    expect(typeIntoSegment("h", "a")).toMatchObject({ text: "", value: null });
    expect(typeIntoSegment("h", "7 PM")).toMatchObject({ text: "7", value: 7 });
  });
});

describe("typeIntoSegment — minutos (00–59)", () => {
  it("«59» es válido y se aplica al instante", () => {
    expect(typeIntoSegment("m", "59")).toMatchObject({ value: 59, immediate: true });
  });

  it("«60» es borrador inválido: no se aplica", () => {
    expect(typeIntoSegment("m", "60")).toEqual({ text: "60", value: null, complete: false, immediate: false });
    expect(typeKeys("m", "60")).toMatchObject({ text: "60", value: null });
  });

  it("«6» no se aplica de paso: si luego llega «0», nunca quedó guardado 06", () => {
    expect(typeIntoSegment("m", "6")).toMatchObject({ value: 6, immediate: false });
  });

  it("«5» espera (puede ser 5x); al salir se aplica como 05", () => {
    expect(typeIntoSegment("m", "5")).toMatchObject({ text: "5", value: 5, complete: false, immediate: false });
    expect(pad2(5)).toBe("05");
  });

  it("acepta cualquier minuto exacto, sin redondear", () => {
    expect(typeKeys("m", "47")).toMatchObject({ value: 47, immediate: true });
    expect(typeKeys("m", "02")).toMatchObject({ value: 2, immediate: true });
  });
});

describe("nextSegmentText — escribir sin depender del cursor", () => {
  const key = (data: string, value = "??") => ({ inputType: "insertText", data, value });
  const back = { inputType: "deleteContentBackward", data: null, value: "??" };

  it("la primera tecla tras enfocar reemplaza el número (cursor en «0|7» no importa)", () => {
    expect(nextSegmentText("", key("2", "027"))).toBe("2");
  });

  it("las siguientes teclas se suman: 2 → 23", () => {
    expect(nextSegmentText("2", key("3"))).toBe("23");
  });

  it("con dos dígitos ya escritos, la siguiente tecla empieza de nuevo: 24 + 1 → 1", () => {
    expect(nextSegmentText("24", key("1"))).toBe("1");
    expect(typeKeys("h", "241")).toMatchObject({ text: "1", value: 1 });
    expect(typeKeys("h", "2413")).toMatchObject({ text: "13", value: 13, immediate: true });
  });

  it("retroceso quita el último dígito; desde cero deja el campo vacío", () => {
    expect(nextSegmentText("24", back)).toBe("2");
    expect(nextSegmentText("", back)).toBe("");
  });

  it("corregir un borrador inválido lo vuelve válido: 24 ← 3 → 23", () => {
    const corrected = nextSegmentText(nextSegmentText("24", back), key("3"));
    expect(typeIntoSegment("h", corrected)).toMatchObject({ text: "23", value: 23, immediate: true });
  });

  it("pegar u otras ediciones usan el valor completo del campo", () => {
    expect(nextSegmentText("", { inputType: "insertFromPaste", data: null, value: "18" })).toBe("18");
    expect(nextSegmentText("4", { value: "45" })).toBe("45");
  });
});

describe("stepSegment — flechas", () => {
  it("hora ±1 con vuelta: 23 → 00 y 00 → 23", () => {
    expect(stepSegment("h", 23, 1)).toBe(0);
    expect(stepSegment("h", 0, -1)).toBe(23);
    expect(stepSegment("h", 7, 1)).toBe(8);
  });

  it("minutos ±5 desde un valor exacto, sin redondear: 47 → 52, 02 → 57", () => {
    expect(BUTTON_STEP).toEqual({ h: 1, m: 5 });
    expect(stepSegment("m", 47, 5)).toBe(52);
    expect(stepSegment("m", 2, -5)).toBe(57);
    expect(stepSegment("m", 58, 5)).toBe(3);
  });

  it("teclado ±1 en minutos: 59 → 00", () => {
    expect(stepSegment("m", 59, 1)).toBe(0);
    expect(stepSegment("m", 0, -1)).toBe(59);
  });
});

describe("splitTime / joinTime / withSegment", () => {
  it("00:00, 07:30 y 23:59 van y vuelven igual", () => {
    for (const t of ["00:00", "07:30", "23:59"]) expect(joinTime(splitTime(t))).toBe(t);
    expect(splitTime("07:30")).toEqual({ h: 7, m: 30 });
  });

  it("cambiar la hora conserva los minutos y viceversa", () => {
    expect(withSegment("07:30", "h", 23)).toBe("23:30");
    expect(withSegment("07:30", "m", 5)).toBe("07:05");
    expect(withSegment("23:47", "h", 0)).toBe("00:47");
  });
});
