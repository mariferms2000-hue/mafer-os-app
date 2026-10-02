import { describe, it, expect } from "vitest";
import { sleepTimeline } from "../src/lib/sleep-timeline";
import { bedtimesFor, wakeTimesFor, parseTime } from "../src/lib/sleep-logic";

const t = (hhmm: string) => parseTime(hhmm)!;
const r = (n: number) => Math.round(n * 1000) / 1000;
const TOTAL = 7 * 90 + 15; // 645 min

describe("sleepTimeline — «Despertar a… 07:30»", () => {
  const tl = sleepTimeline("despertar", t("07:30"), "07:30", bedtimesFor(t("07:30")));

  it("el ancla (hora de despertar) va a la derecha", () => {
    expect(tl.anchor).toEqual({ pos: 1, time: "07:30" });
  });

  it("las opciones van de izquierda a derecha en orden cronológico, separadas un ciclo", () => {
    expect(tl.nodes.map((n) => n.time)).toEqual(["20:45", "22:15", "23:45", "01:15", "02:45"]);
    expect(tl.nodes.map((n) => r(n.pos))).toEqual([0, 90, 180, 270, 360].map((m) => r(m / TOTAL)));
  });

  it("el tramo para dormirse queda justo antes del ancla", () => {
    expect(r(tl.latency.from)).toBe(r(630 / TOTAL));
    expect(tl.latency.to).toBe(1);
  });

  it("marca todas las fronteras de ciclo (8) y las opciones caen sobre ellas", () => {
    expect(tl.ticks).toHaveLength(8);
    for (const n of tl.nodes) expect(tl.ticks.some((x) => r(x) === r(n.pos))).toBe(true);
  });

  it("conserva la jerarquía: 5 y 6 ciclos principales", () => {
    expect(tl.nodes.filter((n) => n.emphasis === "primary").map((n) => n.cycles)).toEqual([6, 5]);
  });
});

describe("sleepTimeline — «Dormir a… 23:47»", () => {
  const tl = sleepTimeline("dormir", t("23:47"), "23:47", wakeTimesFor(t("23:47")));

  it("el ancla (hora de acostarse) va a la izquierda y el tramo para dormirse justo después", () => {
    expect(tl.anchor).toEqual({ pos: 0, time: "23:47" });
    expect(tl.latency.from).toBe(0);
    expect(r(tl.latency.to)).toBe(r(15 / TOTAL));
  });

  it("las opciones cruzan la medianoche sin desordenarse", () => {
    expect(tl.nodes.map((n) => n.time)).toEqual(["04:32", "06:02", "07:32", "09:02", "10:32"]);
    expect(tl.nodes.map((n) => r(n.pos))).toEqual([285, 375, 465, 555, 645].map((m) => r(m / TOTAL)));
    expect(tl.nodes.at(-1)!.pos).toBe(1);
  });

  it("todas las posiciones quedan entre 0 y 1", () => {
    for (const x of [...tl.ticks, ...tl.nodes.map((n) => n.pos)]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    }
  });
});
