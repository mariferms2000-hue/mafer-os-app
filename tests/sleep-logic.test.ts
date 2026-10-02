import { describe, it, expect } from "vitest";
import {
  bedtimesFor,
  wakeTimesFor,
  parseTime,
  formatTime,
  formatDuration,
  wrapMinutes,
  minutesFromDeviceClock,
  readSleepState,
  sleepStateQuery,
  parseSleepMode,
  optionsFor,
  DEFAULT_TIMES,
  DEFAULT_SLEEP_STATE,
  hasSleepParams,
  serializeSleepState,
  parseStoredSleepState,
  SLEEP_STORAGE_KEY,
  CYCLE_OPTIONS,
  SLEEP_CYCLE_MIN,
  SLEEP_LATENCY_MIN,
} from "../src/lib/sleep-logic";

const t = (hhmm: string) => parseTime(hhmm)!;
const times = (opts: { time: string }[]) => opts.map((o) => o.time);

describe("supuestos", () => {
  it("ciclos de 90 min, 15 min para dormirse, y 7, 6, 5, 4 y 3 ciclos", () => {
    expect(SLEEP_CYCLE_MIN).toBe(90);
    expect(SLEEP_LATENCY_MIN).toBe(15);
    expect([...CYCLE_OPTIONS]).toEqual([7, 6, 5, 4, 3]);
  });
});

describe("bedtimesFor — «Quiero despertar a…»", () => {
  it("despertar 07:30 → acostarse 20:45 · 22:15 · 23:45 · 01:15 · 02:45", () => {
    expect(times(bedtimesFor(t("07:30")))).toEqual(["20:45", "22:15", "23:45", "01:15", "02:45"]);
  });

  it("ofrece 7, 6, 5, 4 y 3 ciclos: de 10 h 30 min a 4 h 30 min", () => {
    const opts = bedtimesFor(t("07:30"));
    expect(opts.map((o) => o.cycles)).toEqual([7, 6, 5, 4, 3]);
    expect(opts.map((o) => o.durationLabel)).toEqual(["10 h 30 min", "9 h", "7 h 30 min", "6 h", "4 h 30 min"]);
    expect(opts.map((o) => o.sleepMinutes)).toEqual([630, 540, 450, 360, 270]);
  });

  it("solo 5 y 6 ciclos son principales; 7, 4 y 3 son secundarias", () => {
    expect(bedtimesFor(t("07:30")).map((o) => o.emphasis)).toEqual([
      "secondary",
      "primary",
      "primary",
      "secondary",
      "secondary",
    ]);
  });

  it("cruza la medianoche hacia atrás sin valores negativos", () => {
    // 00:10 − 15 − 540 = −545 → 14:55 del día anterior
    const opts = bedtimesFor(t("00:10"));
    expect(times(opts)).toEqual(["13:25", "14:55", "16:25", "17:55", "19:25"]);
    opts.forEach((o) => expect(o.minutes).toBeGreaterThanOrEqual(0));
  });

  it("funciona con un despertar a mediodía y con 00:00", () => {
    expect(times(bedtimesFor(t("12:00")))).toEqual(["01:15", "02:45", "04:15", "05:45", "07:15"]);
    expect(times(bedtimesFor(t("00:00")))).toEqual(["13:15", "14:45", "16:15", "17:45", "19:15"]);
  });

  it("acepta parámetros propios (para ajustes futuros)", () => {
    expect(times(bedtimesFor(t("07:00"), { latencyMinutes: 20, cycleMinutes: 100 }))).toEqual(["19:00", "20:40", "22:20", "00:00", "01:40"]);
  });
});

describe("wakeTimesFor — «Quiero dormir a…» y «Me voy a dormir ahora»", () => {
  it("acostarse 23:00 → despertar 03:45 · 05:15 · 06:45 · 08:15 · 09:45 (cronológico)", () => {
    expect(times(wakeTimesFor(t("23:00")))).toEqual(["03:45", "05:15", "06:45", "08:15", "09:45"]);
  });

  it("de menos a más sueño (3 → 7 ciclos), con 5 y 6 al centro como principales", () => {
    const opts = wakeTimesFor(t("23:00"));
    expect(opts.map((o) => o.cycles)).toEqual([3, 4, 5, 6, 7]);
    expect(opts.map((o) => o.durationLabel)).toEqual(["4 h 30 min", "6 h", "7 h 30 min", "9 h", "10 h 30 min"]);
    expect(opts.map((o) => o.emphasis)).toEqual(["secondary", "secondary", "primary", "primary", "secondary"]);
  });

  it("cruza la medianoche hacia adelante", () => {
    // 22:00 + 15 + 360 = 1695 → 04:15 del día siguiente
    expect(times(wakeTimesFor(t("22:00")))).toEqual(["02:45", "04:15", "05:45", "07:15", "08:45"]);
    expect(times(wakeTimesFor(t("23:59")))).toEqual(["04:44", "06:14", "07:44", "09:14", "10:44"]);
  });

  it("usa la hora exacta al minuto, sin redondear (caso «ahora»)", () => {
    expect(times(wakeTimesFor(t("23:47")))).toEqual(["04:32", "06:02", "07:32", "09:02", "10:32"]);
  });

  it("es el inverso de bedtimesFor", () => {
    for (const wake of ["07:30", "06:00", "00:10", "13:05"]) {
      const beds = bedtimesFor(t(wake));
      for (const b of beds) {
        const back = wakeTimesFor(b.minutes).find((o) => o.cycles === b.cycles)!;
        expect(back.time).toBe(wake);
      }
    }
  });
});

describe("parseTime", () => {
  it("lee horas válidas de 24 h", () => {
    expect(parseTime("07:30")).toBe(450);
    expect(parseTime("7:30")).toBe(450);
    expect(parseTime("00:00")).toBe(0);
    expect(parseTime("23:59")).toBe(1439);
    expect(parseTime(" 22:15 ")).toBe(1335);
  });

  it("rechaza lo que no es una hora (URL manipulada, vacío, AM/PM)", () => {
    for (const bad of ["24:00", "12:60", "7", "07:3", "abc", "", "7:30 PM", "-1:00", null, undefined]) {
      expect(parseTime(bad)).toBeNull();
    }
  });
});

describe("formatTime y formatDuration", () => {
  it("formatea en 24 h con ceros a la izquierda y envuelve el día", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(75)).toBe("01:15");
    expect(formatTime(1335)).toBe("22:15");
    expect(formatTime(-105)).toBe("22:15");
    expect(formatTime(1440 + 75)).toBe("01:15");
  });

  it("escribe las duraciones como las verá Mafer", () => {
    expect(formatDuration(540)).toBe("9 h");
    expect(formatDuration(450)).toBe("7 h 30 min");
    expect(formatDuration(360)).toBe("6 h");
    expect(formatDuration(45)).toBe("45 min");
  });

  it("wrapMinutes lleva cualquier valor al rango 0–1439", () => {
    expect(wrapMinutes(-1)).toBe(1439);
    expect(wrapMinutes(1440)).toBe(0);
    expect(wrapMinutes(-2880 + 30)).toBe(30);
  });
});

describe("minutesFromDeviceClock — excepción: hora local del dispositivo", () => {
  it("lee la hora y minuto locales del Date recibido", () => {
    expect(minutesFromDeviceClock(new Date(2026, 8, 30, 23, 47))).toBe(1427);
    expect(minutesFromDeviceClock(new Date(2026, 8, 30, 0, 5))).toBe(5);
  });

  // `npm run test:unit` fija TZ=UTC: el dispositivo «está» en UTC, así que un
  // instante que en México son las 23:00 debe dar las 05:00, no las 23:00.
  it.skipIf(process.env.TZ !== "UTC")("no usa la hora de México", () => {
    expect(minutesFromDeviceClock(new Date("2026-10-01T05:00:00Z"))).toBe(300);
  });
});

const qs = (query: string) => new URLSearchParams(query);

describe("estado en la URL — readSleepState / sleepStateQuery", () => {
  it("abre exactamente el estado de una URL válida", () => {
    expect(readSleepState(qs("modo=despertar&h=07:30"))).toEqual({ mode: "despertar", time: "07:30", canonical: true });
    expect(readSleepState(qs("modo=dormir&h=23:00"))).toEqual({ mode: "dormir", time: "23:00", canonical: true });
  });

  it("sin parámetros: «Despertar a…» a las 07:30, marcada para reescribir", () => {
    expect(readSleepState(qs(""))).toEqual({ mode: "despertar", time: "07:30", canonical: false });
  });

  it("modo desconocido → despertar; conserva una hora válida", () => {
    expect(readSleepState(qs("modo=siesta&h=06:15"))).toEqual({ mode: "despertar", time: "06:15", canonical: false });
    expect(parseSleepMode(null)).toBe("despertar");
    expect(parseSleepMode("DORMIR")).toBe("despertar");
  });

  it("hora inválida o ausente → la de por defecto de ese modo, sin romper", () => {
    for (const h of ["25:00", "abc", "7:30 PM", "", "12:60"]) {
      expect(readSleepState(qs(`modo=dormir&h=${encodeURIComponent(h)}`))).toEqual({ mode: "dormir", time: DEFAULT_TIMES.dormir, canonical: false });
      expect(readSleepState(qs(`modo=despertar&h=${encodeURIComponent(h)}`)).time).toBe(DEFAULT_TIMES.despertar);
    }
    expect(readSleepState(qs("modo=dormir")).time).toBe("23:00");
  });

  it("normaliza horas sin cero a la izquierda y las marca para reescribir", () => {
    expect(readSleepState(qs("modo=despertar&h=7:30"))).toEqual({ mode: "despertar", time: "07:30", canonical: false });
  });

  it("parámetros repetidos: se queda con el primero", () => {
    expect(readSleepState(qs("modo=dormir&modo=despertar&h=22:00&h=05:00"))).toMatchObject({ mode: "dormir", time: "22:00" });
  });

  it("escribe la URL en orden fijo y es reversible", () => {
    expect(sleepStateQuery({ mode: "dormir", time: "23:00" })).toBe("modo=dormir&h=23:00");
    const back = readSleepState(qs(sleepStateQuery({ mode: "despertar", time: "06:45" })));
    expect(back).toEqual({ mode: "despertar", time: "06:45", canonical: true });
  });
});

describe("optionsFor — un solo punto de entrada por modo", () => {
  it("despertar usa bedtimesFor y dormir usa wakeTimesFor", () => {
    expect(optionsFor("despertar", t("07:30"))).toEqual(bedtimesFor(t("07:30")));
    expect(optionsFor("dormir", t("23:00"))).toEqual(wakeTimesFor(t("23:00")));
  });

  it("cambiar de modo con la misma hora da el cálculo inverso", () => {
    expect(times(optionsFor("despertar", t("23:00")))).toEqual(["12:15", "13:45", "15:15", "16:45", "18:15"]);
    expect(times(optionsFor("dormir", t("23:00")))).toEqual(["03:45", "05:15", "06:45", "08:15", "09:45"]);
  });
});

describe("hasSleepParams — ¿manda la URL?", () => {
  it("con modo u hora (aunque sean inválidos) manda la URL", () => {
    expect(hasSleepParams(qs("modo=dormir&h=23:47"))).toBe(true);
    expect(hasSleepParams(qs("h=7:30"))).toBe(true);
    expect(hasSleepParams(qs("modo=siesta"))).toBe(true);
  });

  it("sin ellos se usa lo guardado o los valores por defecto", () => {
    expect(hasSleepParams(qs(""))).toBe(false);
    expect(hasSleepParams(qs("otra=1"))).toBe(false);
    expect(DEFAULT_SLEEP_STATE).toEqual({ mode: "despertar", time: "07:30" });
  });
});

describe("última selección en el dispositivo — serialize / parseStored", () => {
  it("guarda solo modo y hora, con la clave mafer-sueno", () => {
    expect(SLEEP_STORAGE_KEY).toBe("mafer-sueno");
    expect(JSON.parse(serializeSleepState({ mode: "dormir", time: "23:47" }))).toEqual({ modo: "dormir", hora: "23:47" });
  });

  it("recupera lo guardado tal cual", () => {
    expect(parseStoredSleepState(serializeSleepState({ mode: "dormir", time: "23:47" }))).toEqual({ mode: "dormir", time: "23:47" });
    expect(parseStoredSleepState('{"modo":"despertar","hora":"06:45"}')).toEqual({ mode: "despertar", time: "06:45" });
  });

  it("normaliza una hora vieja sin cero a la izquierda", () => {
    expect(parseStoredSleepState('{"modo":"despertar","hora":"6:05"}')).toEqual({ mode: "despertar", time: "06:05" });
  });

  it("vacío o ausente → null (valores por defecto)", () => {
    expect(parseStoredSleepState(null)).toBeNull();
    expect(parseStoredSleepState(undefined)).toBeNull();
    expect(parseStoredSleepState("")).toBeNull();
  });

  it("JSON corrupto o con otra forma → null, sin lanzar", () => {
    for (const raw of ["{oops", "null", "42", '"dormir"', "[]", "true"]) {
      expect(parseStoredSleepState(raw)).toBeNull();
    }
  });

  it("modo inválido → null (no se rellena: se ignora todo)", () => {
    expect(parseStoredSleepState('{"modo":"siesta","hora":"23:10"}')).toBeNull();
    expect(parseStoredSleepState('{"hora":"23:10"}')).toBeNull();
  });

  it("hora inválida → null", () => {
    for (const hora of ['"25:00"', '"12:60"', '"7:30 PM"', '""', "730", "null"]) {
      expect(parseStoredSleepState(`{"modo":"dormir","hora":${hora}}`)).toBeNull();
    }
  });

  it("ignora campos extra de versiones viejas", () => {
    expect(parseStoredSleepState('{"modo":"dormir","hora":"22:00","ciclos":5,"ts":1}')).toEqual({ mode: "dormir", time: "22:00" });
  });
});
