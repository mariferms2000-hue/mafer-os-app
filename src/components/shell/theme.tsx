"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Sun, Moon, MonitorSmartphone } from "lucide-react";

export type ThemePref = "light" | "dark" | "auto";

export function applyTheme(pref: ThemePref) {
  try {
    localStorage.setItem("mafer-theme", pref);
  } catch {}
  const resolved =
    pref === "auto"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : pref;
  const html = document.documentElement;
  html.setAttribute("data-theme", resolved);
  html.setAttribute("data-theme-pref", pref);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#0d100c" : "#faf7f1");
  window.dispatchEvent(new Event("mafer-theme-change"));
}

function subscribePref(cb: () => void) {
  window.addEventListener("mafer-theme-change", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("mafer-theme-change", cb);
    window.removeEventListener("storage", cb);
  };
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    subscribePref,
    () => (document.documentElement.getAttribute("data-theme-pref") as ThemePref) || "light",
    () => "light"
  );
}

/** Mantiene el tema en sincronía con el sistema cuando la preferencia es «auto». */
export function ThemeWatcher() {
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const pref = (localStorage.getItem("mafer-theme") as ThemePref) || "light";
      if (pref === "auto") applyTheme("auto");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return null;
}

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "auto", label: "Automático", icon: MonitorSmartphone },
];

/** Segmented control para Ajustes → Apariencia. */
export function ThemeSelector() {
  const pref = useThemePref();
  return (
    <div role="radiogroup" aria-label="Tema de la aplicación" className="inline-flex rounded-xl border border-sand bg-beige p-1 gap-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`theme-${value}`}
            onClick={() => applyTheme(value)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-forest text-cream" : "text-ink-green hover:bg-sand"
            }`}
          >
            <Icon size={15} aria-hidden /> {label}
          </button>
        );
      })}
    </div>
  );
}

/** Botón rápido de la barra lateral: alterna claro ⇄ oscuro. */
export function ThemeQuickToggle() {
  const pref = useThemePref();
  const resolvedDark =
    typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";
  return (
    <button
      type="button"
      aria-label={resolvedDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={`Tema: ${pref === "auto" ? "automático" : pref === "dark" ? "oscuro" : "claro"}`}
      className="btn btn-ghost !p-2"
      data-testid="theme-quick-toggle"
      onClick={() => applyTheme(resolvedDark ? "light" : "dark")}
    >
      {resolvedDark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
    </button>
  );
}
