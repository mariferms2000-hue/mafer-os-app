// Siembra la base de previews (mafer_preview) con datos 100 % ficticios.
// Nada sale de producción: todo lo que hay aquí está escrito a mano.
//
//   npm run seed:preview            → siembra si la base está vacía; si ya es
//                                      una base de preview, solo actualiza la
//                                      contraseña de acceso.
//   npm run seed:preview -- --reset → vacía y vuelve a sembrar (solo si la base
//                                      lleva la marca data_environment=preview).
//
// La contraseña sale de PREVIEW_LOGIN_PASSWORD (.env.local) y nunca se imprime.
// La marca `data_environment = preview` en settings es la que exige la app
// desplegada en Preview para arrancar (src/lib/data-environment.ts).
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { requirePreviewDatabaseUrl } from "./lib/require-test-db.mjs";

const url = requirePreviewDatabaseUrl();
const password = process.env.PREVIEW_LOGIN_PASSWORD;
if (!password || password.length < 12) {
  console.error("Falta PREVIEW_LOGIN_PASSWORD (mínimo 12 caracteres) en .env.local — ver docs/previews.md.");
  process.exit(1);
}
const reset = process.argv.includes("--reset");

const TABLES = [
  "settings", "projects", "boards", "columns", "cards", "today_priorities", "inbox_items",
  "journal_entries", "learning_topics", "ideas", "prompts", "ai_tools", "agents_skills",
  "decisions", "resources", "events", "trips", "reviews", "focus_sessions", "focus_plants",
  "focus_session_plant_allocations", "recent_views",
];

// ── Fechas relativas a HOY en hora de México (igual que la app) ──
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
const dia = (n) => {
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const hace = (dias) => new Date(Date.now() - dias * 86_400_000).toISOString();
const id = () => randomUUID();

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });

async function setSetting(tx, key, value) {
  await tx`insert into settings (key, value, updated_at) values (${key}, ${value}, ${new Date().toISOString()})
           on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`;
}

try {
  const [marker] = await sql`select value from settings where key = 'data_environment'`;
  const [{ n: filas }] = await sql`select (select count(*) from settings) + (select count(*) from projects) as n`;
  const hash = await bcrypt.hash(password, 12);

  if (marker && marker.value !== "preview") {
    throw new Error(`Esta base está marcada como «${marker.value}», no como preview. No se toca.`);
  }
  if (!marker && Number(filas) > 0) {
    throw new Error("La base tiene datos pero no la marca de preview. No se toca: revisa a qué base apunta PREVIEW_DATABASE_URL.");
  }
  if (marker && !reset) {
    await sql.begin((tx) => setSetting(tx, "password_hash", hash));
    console.log("Base de preview ya sembrada: solo se actualizó la contraseña de acceso ✓");
  } else {
    await sql.begin(async (tx) => {
      if (reset) {
        await tx.unsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
      }
      await seed(tx, hash);
    });
    console.log(`Base de preview sembrada con datos ficticios ✓ (hoy = ${hoy})`);
  }
} catch (e) {
  console.error("No se sembró nada:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}

async function seed(tx, hash) {
  const t = new Date().toISOString();
  await setSetting(tx, "data_environment", "preview");
  await setSetting(tx, "password_hash", hash);
  await setSetting(tx, "user_name", "Mafer");
  await setSetting(tx, "review:weekly-day", "0");

  // ── Proyectos, cada uno con su tablero y las 7 listas por defecto ──
  const KINDS = [
    ["Backlog", "backlog"], ["Próximo", "proximo"], ["En proceso", "proceso"], ["Esperando", "esperando"],
    ["Bloqueado", "bloqueado"], ["Después", "despues"], ["Terminado", "terminado"],
  ];
  const proyectos = [
    { key: "estudio", title: "Rediseño del estudio", area: "profesional", priority: "alta", health: "atencion", icon: "briefcase", color: "sage",
      objective: "Nueva identidad y web del estudio antes de fin de mes.", resume: "Quedé en revisar la paleta con Laura; falta el texto de la página Servicios." },
    { key: "mudanza", title: "Mudanza a Querétaro", area: "personal", priority: "alta", health: "bien", icon: "home", color: "sand",
      objective: "Mudarme sin estrés y con todo en orden." },
    { key: "ceramica", title: "Curso de cerámica", area: "aprendizaje", priority: "media", health: "bien", icon: "palette", color: "clay" },
    { key: "boda", title: "Boda de Ana", area: "familia", priority: "media", health: "atencion", icon: "heart", color: "rose",
      objective: "Ayudar con la organización del brindis." },
    { key: "boletin", title: "Boletín mensual", area: "profesional", priority: "baja", health: "bien", icon: "mail", color: "sage",
      status: "pausado" },
  ];
  const col = {}; // col[proyecto][kind] = { columnId, boardId, projectId }
  for (const p of proyectos) {
    const pid = id(), bid = id();
    await tx`insert into projects (id, title, description, objective, area, status, priority, health, resume_note, color, icon, created_at, updated_at)
             values (${pid}, ${p.title}, ${"Proyecto ficticio para revisar previews."}, ${p.objective ?? ""}, ${p.area},
                     ${p.status ?? "activo"}, ${p.priority}, ${p.health}, ${p.resume ?? ""}, ${p.color}, ${p.icon}, ${hace(40)}, ${hace(2)})`;
    await tx`insert into boards (id, project_id, title) values (${bid}, ${pid}, 'Tablero')`;
    col[p.key] = { projectId: pid };
    for (const [i, [title, kind]] of KINDS.entries()) {
      const cid = id();
      await tx`insert into columns (id, board_id, title, kind, position) values (${cid}, ${bid}, ${title}, ${kind}, ${i})`;
      col[p.key][kind] = { columnId: cid, boardId: bid, projectId: pid };
    }
  }

  // ── Tareas: todos los estados, fechas y recordatorios que la app sabe mostrar ──
  const pos = {};
  const tarea = async (proyecto, kind, title, extra = {}) => {
    const where = proyecto ? col[proyecto][kind] : { columnId: null, boardId: null, projectId: null };
    const k = `${proyecto}:${kind}`;
    pos[k] = (pos[k] ?? -1) + 1;
    const cardId = id();
    await tx`insert into cards ${tx({
      id: cardId, title, description: extra.description ?? "", project_id: where.projectId, board_id: where.boardId,
      column_id: where.columnId, position: pos[k], type: "tarea", priority: extra.priority ?? "media",
      duration: extra.duration ?? null, energy: extra.energy ?? null, due_date: extra.due ?? null,
      start_time: extra.time ?? null, reminder: extra.reminder ?? null, blocked_reason: extra.blocked ?? "",
      waiting_for: extra.waiting ?? "", tags: tx.json(extra.tags ?? []), checklist: tx.json(extra.checklist ?? []),
      links: tx.json([]), archived: extra.archived ?? false, completed_at: extra.completedAt ?? null,
      created_at: hace(extra.age ?? 10), updated_at: hace(extra.touched ?? 1),
    })}`;
    return cardId;
  };

  const sigEstudio = await tarea("estudio", "proximo", "Escribir el texto de la página Servicios", { due: dia(0), time: "11:00", reminder: "gcal-timed", priority: "alta", duration: "thirty_to_60", energy: "high" });
  await tarea("estudio", "proceso", "Elegir paleta de color con Laura", { due: dia(1), duration: "ten_to_30", energy: "medium" });
  await tarea("estudio", "bloqueado", "Publicar el sitio nuevo", { blocked: "Falta que el proveedor del dominio confirme la transferencia — no publicar hasta tener el correo de confirmación por escrito", priority: "alta" });
  await tarea("estudio", "esperando", "Fotos del equipo", { waiting: "Fotógrafa (entrega de la sesión del sábado)", age: 20, touched: 12 });
  await tarea("estudio", "backlog", "Revisar tipografías alternativas");
  await tarea("estudio", "terminado", "Brief con el cliente", { completedAt: hace(3) });
  await tarea("mudanza", "proximo", "Cotizar mudanza con tres empresas", { due: dia(-2), priority: "alta", duration: "thirty_to_60" });
  await tarea("mudanza", "proximo", "Dar de baja internet del departamento", { due: dia(4), time: "09:30", reminder: "gcal-timed", duration: "under_10", energy: "low" });
  await tarea("mudanza", "proximo", "Comprar cajas y cinta", { due: dia(2), reminder: "gcal-allday", duration: "ten_to_30", energy: "low" });
  await tarea("mudanza", "esperando", "Firma del contrato nuevo", { waiting: "Inmobiliaria", due: dia(6) });
  await tarea("mudanza", "despues", "Pintar el cuarto de visitas");
  await tarea("ceramica", "proceso", "Practicar centrado en el torno", { checklist: [
    { id: id(), text: "Amasar 2 kg de barro", done: true },
    { id: id(), text: "Tres intentos de centrado", done: false },
  ] });
  await tarea("ceramica", "proximo", "Inscribirme al taller de esmaltes", { due: dia(9) });
  await tarea("boda", "bloqueado", "Ensayar el brindis", { blocked: "Ana aún no define el orden de los discursos", age: 30, touched: 18 });
  await tarea("boda", "proximo", "Mandar la playlist al DJ", { due: dia(-5), duration: "under_10" });
  await tarea("boletin", "backlog", "Ideas para el número de diciembre");
  await tarea(null, null, "Renovar la licencia de manejo", { due: dia(3), time: "10:00", reminder: "gcal-timed" });
  await tarea(null, null, "Llamar al banco por el cargo duplicado", { duration: "under_10", energy: "low" });
  await tarea(null, null, "Leer el contrato del seguro", { archived: true });
  await tx`update projects set next_action_card_id = ${sigEstudio} where id = ${col.estudio.projectId}`;

  // ── Inbox: capturas tal como llegan por Siri o a mano ──
  const capturas = [
    ["Comprar croquetas para Luna", 0], ["Preguntarle a Diego por el libro de cerámica", 0], ["Idea: serie de posts sobre procesos", 1],
    ["Cita con la dermatóloga", 2], ["Revisar el estado de cuenta de octubre", 3], ["Regalo de cumpleaños para papá", 4],
    ["Cambiar filtro del purificador", 6], ["Investigar cursos de fotografía", 8], ["Pagar tenencia", 9],
    ["Recetas para la semana", 12], ["Agendar mantenimiento del coche", 15], ["Buscar plomero para la regadera", 18],
  ];
  for (const [content, d] of capturas) {
    await tx`insert into inbox_items (id, content, created_at) values (${id()}, ${content}, ${hace(d)})`;
  }
  await tx`insert into inbox_items (id, content, processed, converted_to, created_at) values (${id()}, 'Captura ya procesada de ejemplo', true, 'archivado', ${hace(5)})`;

  // ── Calendario ──
  const evento = (title, date, startTime, endTime, type, notes = "") =>
    tx`insert into events (id, title, date, start_time, end_time, type, notes, created_at) values (${id()}, ${title}, ${date}, ${startTime}, ${endTime}, ${type}, ${notes}, ${t})`;
  await evento("Llamada con el cliente del estudio", dia(0), "10:00", "10:45", "reunion");
  await evento("Clase de cerámica", dia(0), "18:00", "20:00", "evento");
  await evento("Cumpleaños de Ana", dia(1), null, null, "recordatorio");
  await evento("Dentista", dia(2), "17:30", "18:30", "cita");
  await evento("Entrega del diseño", dia(5), null, null, "deadline");
  await evento("Comida familiar", dia(-3), "14:00", "16:00", "evento");
  await tx`insert into trips (id, title, destination, start_date, end_date, notes, created_at) values (${id()}, 'Fin de semana en Oaxaca', 'Oaxaca', ${dia(12)}, ${dia(14)}, '', ${t})`;

  // ── Biblioteca y Explorar ──
  for (const [title, category, status] of [
    ["Taller de cerámica para niños", "negocio", "incubando"], ["Podcast sobre diseño latinoamericano", "proyecto", "incubando"],
    ["Aprender encuadernación", "estudio", "algun-dia"], ["Tienda en línea de piezas", "negocio", "incubando"],
  ]) {
    await tx`insert into ideas (id, title, description, category, status, created_at, updated_at) values (${id()}, ${title}, 'Idea ficticia.', ${category}, ${status}, ${hace(20)}, ${hace(5)})`;
  }
  await tx`insert into learning_topics ${tx({
    id: id(), title: "Fotografía de producto", motivation: "Mejorar las fotos del portafolio.", outcome: "Fotos limpias con luz natural.",
    depth: "fundamentos", status: "activo", key_questions: tx.json(["¿Qué luz uso sin estudio?", "¿Qué fondo funciona mejor?"]),
    sprint: tx.json({ goal: "Diez fotos aceptables", start: dia(-4), end: dia(10), steps: [{ id: id(), text: "Ver tutorial de luz", done: true }, { id: id(), text: "Sesión de prueba", done: false }] }),
    progress: 35, created_at: hace(15), updated_at: hace(2),
  })}`;
  await tx`insert into learning_topics (id, title, motivation, status, created_at, updated_at) values (${id()}, 'Italiano básico', 'Para el viaje del próximo año.', 'idea', ${hace(30)}, ${hace(30)})`;
  for (const [title, body, d, tpl] of [
    ["Semana intensa", "Mucho trabajo, pero salió bien la presentación.", -1, "libre"],
    ["Lo que aprendí del torno", "Paciencia: el barro avisa cuando no está centrado.", -6, "aprendizaje"],
    ["Gratitud", "Comida con mi familia, un día tranquilo.", -3, "gratitud"],
  ]) {
    await tx`insert into journal_entries (id, title, body, date, template_type, created_at, updated_at) values (${id()}, ${title}, ${body}, ${dia(d)}, ${tpl}, ${hace(-d)}, ${hace(-d)})`;
  }
  await tx`insert into decisions (id, title, date, project_id, context, decision, reason, created_at) values
    (${id()}, 'Mudanza en noviembre, no en diciembre', ${dia(-10)}, ${col.mudanza.projectId}, 'Fechas de contrato', 'Mudarme el 15 de noviembre', 'Evitar diciembre y sus precios', ${hace(10)})`;
  await tx`insert into decisions (id, title, date, context, decision, reason, created_at) values
    (${id()}, 'Pausar el boletín un mes', ${dia(-20)}, 'Poco tiempo', 'Retomarlo en enero', 'Priorizar el estudio', ${hace(20)})`;
  for (const [title, body, tool, fav] of [
    ["Revisar un texto con tono cálido", "Revisa este texto y propón una versión más cálida y clara…", "claude", true],
    ["Plan de proyecto en fases", "Divide este proyecto en fases pequeñas con criterios de aceptación…", "claude-code", false],
    ["Ideas de contenido", "Dame 10 ideas de publicaciones sobre…", "chatgpt", false],
  ]) {
    await tx`insert into prompts (id, title, body, tool, favorite, created_at, updated_at) values (${id()}, ${title}, ${body}, ${tool}, ${fav}, ${hace(30)}, ${hace(4)})`;
  }
  for (const [title, type, rurl, status] of [
    ["Guía de luz natural", "articulo", "https://example.com/luz-natural", "pendiente"],
    ["Curso introductorio de torno", "video", "https://example.com/torno", "en-proceso"],
    ["Checklist de mudanza", "documento", "https://example.com/checklist", "revisado"],
  ]) {
    await tx`insert into resources (id, title, type, url, status, created_at) values (${id()}, ${title}, ${type}, ${rurl}, ${status}, ${hace(8)})`;
  }

  // ── Jardín de enfoque: 3 plantas completas + la actual en 100 min ──
  const plantas = [["monstera", 150, 30], ["lavanda", 150, 20], ["pilea", 150, 10], ["helecho", 100, 4]];
  for (const [i, [species, minutes, startedDaysAgo]] of plantas.entries()) {
    const pid = id();
    const done = minutes >= 150;
    await tx`insert into focus_plants (id, species, accumulated_minutes, visual_seed, renderer_version, started_at, completed_at)
             values (${pid}, ${species}, ${minutes}, ${1000 + i * 7919}, 2, ${hace(startedDaysAgo)}, ${done ? hace(startedDaysAgo - 6) : null})`;
    // Sesiones cerradas que suman exactamente los minutos de la planta (invariante de 7E.2).
    for (let left = minutes, s = 0; left > 0; s++) {
      const m = Math.min(25, left);
      left -= m;
      const sid = id();
      const when = hace(startedDaysAgo - s * 0.5);
      await tx`insert into focus_sessions (id, preset, planned_focus_min, planned_break_min, phase, phase_started_at,
                 elapsed_focus_seconds, elapsed_break_seconds, date, started_at, finished_at, outcome, credited_minutes, created_at)
               values (${sid}, 'pomodoro', 25, 5, 'enfoque-listo', ${when}, ${m * 60}, 0, ${when.slice(0, 10)}, ${when}, ${when},
                 ${m === 25 ? "completa" : "terminada-antes"}, ${m}, ${when})`;
      await tx`insert into focus_session_plant_allocations (id, session_id, plant_id, credited_minutes, created_at) values (${id()}, ${sid}, ${pid}, ${m}, ${when})`;
    }
  }

  await tx`insert into reviews (id, type, date, started_at, finished_at, completed, step, processed) values (${id()}, 'diaria', ${dia(-9)}, ${hace(9)}, ${hace(9)}, true, 5, 3)`;
}
