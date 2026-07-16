"use client";

import { DURATIONS, ENERGIES, DURATION_LABEL, ENERGY_LABEL } from "@/lib/estimates";

/** Chips personalizados (nada de selectores nativos) para elegir un valor o
 *  «Sin estimar». Accesibles: radiogroup, foco con teclado, área táctil cómoda. */
function ChipGroup({
  label,
  options,
  value,
  onChange,
  testPrefix,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
  testPrefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`${testPrefix}-${o.value}`}
            onClick={() => onChange(o.value)}
            className={`chip !min-h-8 transition-colors ${active ? "chip-on" : "hover:bg-sand"}`}
          >
            {o.label}
          </button>
        );
      })}
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        data-testid={`${testPrefix}-none`}
        onClick={() => onChange(null)}
        className={`chip !min-h-8 transition-colors ${value === null ? "chip-on-alt" : "hover:bg-sand"}`}
      >
        Sin estimar
      </button>
    </div>
  );
}

const DURATION_CHIP_LABEL: Record<string, string> = {
  under_10: "<10 min",
  ten_to_30: "10–30",
  thirty_to_60: "30–60",
  over_60: ">60",
};

export function DurationChips({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <ChipGroup
      label="Duración estimada"
      options={DURATIONS.map((d) => ({ value: d, label: DURATION_CHIP_LABEL[d] ?? DURATION_LABEL[d] }))}
      value={value}
      onChange={onChange}
      testPrefix="dur"
    />
  );
}

export function EnergyChips({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <ChipGroup
      label="Energía requerida"
      options={ENERGIES.map((e) => ({ value: e, label: ENERGY_LABEL[e] }))}
      value={value}
      onChange={onChange}
      testPrefix="energy"
    />
  );
}
