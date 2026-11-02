// Jardín de demostración para revisar F4 en la preview (mafer_preview): más
// plantas completadas de todos los tamaños, Agua y Fertilizante en el
// inventario, varias plantas con sed y una recién regada. Nunca toca producción: usa la misma guardia
// que el resto de las previews (scripts/lib/require-test-db.mjs).
//
//   node scripts/seed-garden-preview.mjs           agrega lo que falte (idempotente)
//   node scripts/seed-garden-preview.mjs --reset   además borra todo el cuidado
//                                                  (sed, riegos, especial) y lo vuelve a sembrar
import postgres from "postgres";
import { requirePreviewDatabaseUrl } from "./lib/require-test-db.mjs";

const url = requirePreviewDatabaseUrl();
const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
const reset = process.argv.includes("--reset");
const DAY = 86_400_000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();

const DEMO = [
  ["suculenta", 58, 14101],
  ["cactus", 52, 27311],
  ["potos", 46, 3907],
  ["sansevieria", 40, 51229],
  ["palmera", 34, 7741],
  ["eucalipto", 28, 66013],
  ["olivo", 22, 12007],
  ["bambu", 16, 90001],
];

try {
  for (const [species, daysAgo, seed] of DEMO) {
    await sql`
      INSERT INTO focus_plants (id, species, accumulated_minutes, visual_seed, renderer_version, started_at, completed_at)
      VALUES (${`jardin-demo-${species}`}, ${species}, 150, ${seed}, 2, ${iso(daysAgo + 5)}, ${iso(daysAgo)})
      ON CONFLICT (id) DO NOTHING`;
  }
  if (reset) {
    await sql`DELETE FROM garden_plant_care`;
    await sql`DELETE FROM settings WHERE key IN ('garden_thirst_clock', 'garden_care_since', 'garden_special_plant')`;
    await sql`UPDATE garden_rewards SET used_at = NULL, used_on = NULL WHERE id LIKE 'jardin-demo-%'`;
  }
  const want = { agua: 5, fertilizante: 2 };
  for (const [item, n] of Object.entries(want)) {
    const [{ have }] = await sql`SELECT count(*)::int AS have FROM garden_rewards WHERE item = ${item} AND used_at IS NULL`;
    for (let i = have; i < n; i++) {
      await sql`INSERT INTO garden_rewards (id, item, earned_at) VALUES (${`jardin-demo-${item}-${i}-${Date.now()}`}, ${item}, ${iso(1)})`;
    }
  }
  // Cuatro con sed (tres completadas y la planta actual, para ver el frasco casi
  // vacío) y la palmera recién regada.
  const [{ n: thirsty }] = await sql`SELECT count(*)::int AS n FROM garden_plant_care WHERE thirsty_since IS NOT NULL`;
  if (thirsty === 0) {
    const targets = await sql`
      (SELECT id FROM focus_plants WHERE species IN ('lavanda', 'monstera', 'cactus') AND completed_at IS NOT NULL)
      UNION ALL (SELECT id FROM focus_plants WHERE completed_at IS NULL LIMIT 1)`;
    const t = iso(1);
    for (const { id } of targets) {
      await sql`
        INSERT INTO garden_plant_care (plant_id, thirsty_since, updated_at) VALUES (${id}, ${t}, ${t})
        ON CONFLICT (plant_id) DO UPDATE SET thirsty_since = EXCLUDED.thirsty_since, updated_at = EXCLUDED.updated_at`;
    }
    const w = new Date(Date.now() - 2 * 3_600_000).toISOString();
    await sql`
      INSERT INTO garden_plant_care (plant_id, watered_at, updated_at) VALUES ('jardin-demo-palmera', ${w}, ${w})
      ON CONFLICT (plant_id) DO UPDATE SET watered_at = EXCLUDED.watered_at, thirsty_since = NULL, updated_at = EXCLUDED.updated_at`;
  }
  // El cuidado se estrena ahora: el resto de las plantas empieza hidratado.
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES ('garden_care_since', ${new Date().toISOString()}, ${new Date().toISOString()})
    ON CONFLICT (key) DO NOTHING`;
  console.log("Jardín de demostración listo en mafer_preview ✓");
} finally {
  await sql.end();
}
