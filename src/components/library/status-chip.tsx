const STATUS_META: Record<string, { label: string; cls: string }> = {
  activo: { label: "Activo", cls: "chip-done" },
  experimental: { label: "Experimental", cls: "chip-waiting" },
  planeado: { label: "Planeado", cls: "" },
  deprecado: { label: "Deprecado", cls: "chip-blocked" },
  "no-encontrado": { label: "No encontrado", cls: "chip-blocked" },
};

export function StatusChip({ status }: { status: string | null }) {
  const meta = STATUS_META[status ?? "activo"] ?? STATUS_META.activo;
  return <span className={`chip ${meta.cls}`}>{meta.label}</span>;
}

export const SCOPE_LABEL: Record<string, string> = {
  maca: "MACA",
  global: "Global",
  "mafer-os": "Mafer OS",
  otro: "Otro",
};
