"""Mide las láminas de public/plants y regenera src/lib/garden/asset-bounds.ts.

Correr tras reemplazar el arte de las plantas (requiere Pillow):
    python3 scripts/measure-plant-assets.py
Mide la versión clara, tamaño large, con alfa > 40.
"""
from pathlib import Path
from PIL import Image

SPECIES = ["suculenta", "cactus", "pilea", "lavanda", "potos", "helecho", "sansevieria", "monstera", "palmera", "eucalipto", "olivo", "bambu"]
STAGES = ["semilla", "brote", "hojas", "planta-joven", "planta-completa"]
ROOT = Path(__file__).resolve().parent.parent


def measure(species, stage):
    im = Image.open(ROOT / f"public/plants/{species}-{stage}-light-large.webp").convert("RGBA")
    w, h = im.size
    a = im.getchannel("A").load()
    rows = [[x for x in range(w) if a[x, y] > 40] for y in range(h)]
    ys = [y for y in range(h) if rows[y]]
    top, bot = min(ys), max(ys)
    bottom_pad = (h - 1 - bot) / h
    band = range(max(top, bot - int((bot - top) * 0.12)), bot + 1)
    xs = [x for y in band for x in rows[y]]
    base_x = sum(xs) / len(xs) / w
    # línea de suelo: filas del fondo más anchas que el 35 % del lienzo
    y = bot
    while y > top and len(rows[y]) > 0.35 * w:
        y -= 1
    if y < bot:
        while y > top and not rows[y]:
            y -= 1
    plant_pad = (h - 1 - y) / h
    root = range(int(y - (y - top) * 0.3), y + 1)
    rx = [x for yy in root for x in rows[yy]]
    span = (max(rx) - min(rx)) / w
    return bottom_pad, base_x, plant_pad, span


def table(name, doc, values, fmt):
    lines = [f"  {s}: {{ " + ", ".join(f'"{st}": {fmt(values[s][st])}' for st in STAGES) + " }," for s in SPECIES]
    return f"\n/* {doc} Generado por script; no editar a mano. */\nexport const {name}: Record<Species, Record<StageKey, number>> = {{\n" + "\n".join(lines) + "\n};\n"


def main():
    m = {s: {st: measure(s, st) for st in STAGES} for s in SPECIES}
    f3 = lambda v: f"{v:.3f}"
    out = (
        "/* Medidas de las láminas de public/plants (versión clara, tamaño large).\n"
        "   Regenerar con scripts/measure-plant-assets.py al reemplazar el arte. */\n\n"
        'import type { StageKey } from "@/lib/focus-logic";\n'
        'import type { IllustratedPlantSpecies as Species } from "@/lib/plant-assets";\n'
    )
    out += table("BOTTOM_PAD", "Margen transparente bajo el dibujo (fracción del alto).", {s: {st: m[s][st][0] for st in STAGES} for s in SPECIES}, f3)
    out += table("BASE_X", "Centro horizontal de la base del dibujo (fracción del ancho): tallo, raíces o cepellón.", {s: {st: m[s][st][1] for st in STAGES} for s in SPECIES}, f3)
    out += table("PLANT_PAD", "Como BOTTOM_PAD, ignorando líneas de suelo dibujadas bajo la planta.", {s: {st: m[s][st][2] for st in STAGES} for s in SPECIES}, f3)
    spans = {s: max(m[s][st][3] for st in STAGES[:-1]) for s in SPECIES}
    out += "\n/* Ancho máximo de la base en las etapas que viven en el frasco (fracción del ancho). Generado por script; no editar a mano. */\nexport const ROOT_SPAN: Record<Species, number> = {\n" + "\n".join(f"  {s}: {spans[s]:.2f}," for s in SPECIES) + "\n};\n"
    (ROOT / "src/lib/garden/asset-bounds.ts").write_text(out)


if __name__ == "__main__":
    main()
