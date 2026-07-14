/**
 * Seed de Mafer OS — contenido inicial editable.
 * Se ejecuta con: npm run seed
 * Es idempotente: si ya hay datos sembrados, no duplica nada.
 * Todo lo sembrado lleva is_starter=1 para que Mafer pueda borrarlo sin miedo.
 */
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "mafer-os.db");
if (!fs.existsSync(DB_PATH)) {
  console.error("No existe la base de datos. Inicia la app una vez antes de sembrar.");
  process.exit(1);
}
const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const uid = () => randomUUID();

const seeded = db.prepare("SELECT value FROM settings WHERE key='seeded'").get();
if (seeded) {
  console.log("Ya se había sembrado antes. Nada que hacer.");
  process.exit(0);
}

const COLS = ["Backlog|backlog", "Próximo|proximo", "En proceso|proceso", "Esperando|esperando", "Bloqueado|bloqueado", "Después|despues", "Terminado|terminado"];

function createProject({ title, objective = "", area = "personal", icon = "folder", status = "activo", description = "" }) {
  const id = uid();
  const t = now();
  db.prepare(
    `INSERT INTO projects (id,title,description,objective,area,status,icon,is_starter,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,1,?,?)`
  ).run(id, title, description, objective, area, status, icon, t, t);
  const boardId = uid();
  db.prepare("INSERT INTO boards (id,project_id,title) VALUES (?,?,?)").run(boardId, id, "Tablero");
  const colIds = {};
  COLS.forEach((c, i) => {
    const [titleC, kind] = c.split("|");
    const cid = uid();
    colIds[kind] = cid;
    db.prepare("INSERT INTO columns (id,board_id,title,kind,position) VALUES (?,?,?,?,?)").run(cid, boardId, titleC, kind, i);
  });
  return { id, boardId, colIds };
}

function addCard(project, kind, title, extra = {}) {
  const t = now();
  const siblings = db.prepare("SELECT COUNT(*) n FROM cards WHERE column_id=?").get(project.colIds[kind]).n;
  db.prepare(
    `INSERT INTO cards (id,title,description,project_id,board_id,column_id,position,type,duration,energy,checklist,is_starter,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?)`
  ).run(
    uid(), title, extra.description ?? "", project.id, project.boardId, project.colIds[kind], siblings,
    extra.type ?? "tarea", extra.duration ?? null, extra.energy ?? null,
    JSON.stringify(extra.checklist ?? []), t, t
  );
}

/* ── Proyectos iniciales (cascarones, sin inventar estados) ── */
const maca = createProject({
  title: "MACA Medical Journey",
  objective: "Coordinar el patient journey de pacientes ortopédicos internacionales con claridad y autoridad serena.",
  area: "profesional",
  icon: "stethoscope",
  description: "Cascarón inicial. El detalle del negocio vive en el repositorio y wiki de MACA.",
});
addCard(maca, "proximo", "Definir la próxima acción real de MACA aquí", {
  description: "Tarjeta de ejemplo — reemplázala por tu trabajo real. Puedes arrastrarme entre columnas.",
});

createProject({
  title: "Journal",
  objective: "Mantener el hábito de pensar por escrito.",
  area: "personal",
  icon: "pen",
  description: "Las entradas viven en Explorar → Journal. Este proyecto es para tareas relacionadas (ej. imprimir, revisar).",
});

createProject({
  title: "Sobreviviendo a la IA",
  objective: "Proyecto de contenido/aprendizaje sobre IA.",
  area: "profesional",
  icon: "sparkles",
  description: "Cascarón inicial basado en la carpeta existente en el escritorio.",
});

createProject({
  title: "Proyectos de Mario",
  objective: "Colaboraciones y pendientes compartidos con Mario.",
  area: "familia",
  icon: "users",
});

createProject({
  title: "Personal",
  objective: "Vida, casa, salud, trámites.",
  area: "personal",
  icon: "heart",
});

/* ── Onboarding: proyecto guía con checklist real ── */
const onboarding = createProject({
  title: "Aprender Mafer OS",
  objective: "Dominar tu sistema en una semana, sin prisa.",
  area: "personal",
  icon: "leaf",
  description: "Este proyecto te enseña el sistema usándolo. Borra lo que ya no necesites.",
});
addCard(onboarding, "proximo", "Configurar mi perfil y energía de hoy", { duration: "under_10", energy: "low", description: "En la página Hoy, elige tu energía. En Ajustes puedes cambiar tu nombre." });
addCard(onboarding, "proximo", "Procesar los ejemplos del Inbox", { duration: "ten_to_30", energy: "low", description: "Ve a Inbox y convierte (o borra) las capturas de ejemplo." });
addCard(onboarding, "proximo", "Elegir mis 3 prioridades de hoy", { duration: "under_10", energy: "low" });
addCard(onboarding, "proximo", "Crear mi primera tarea real", { duration: "under_10", energy: "medium", description: "En cualquier proyecto: botón «Añadir tarjeta»." });
addCard(onboarding, "proximo", "Instalar Mafer OS en mi iPhone", { duration: "ten_to_30", description: "Guía completa en la Biblioteca de manuales del vault: «Instalar en iPhone»." });
addCard(onboarding, "despues", "Conectar Google Calendar para recordatorios", { description: "Requiere un paso único en Google Cloud. Guía: «Calendario y recordatorios»." });
addCard(onboarding, "despues", "Abrir mi vault de Obsidian y hacer mi primer respaldo", { description: "Vault: Escritorio → Mafer OS → mafer-os-vault. Respaldo: npm run backup (guía «Respaldos»)." });

/* ── Inbox de ejemplo ── */
const inboxSamples = [
  ["Idea: taller de biotipos para pacientes", "idea"],
  ["Llamar al banco por la tarjeta", "tarea"],
  ["Ver video sobre agentes de Claude que me mandó Mario", "recurso"],
];
for (const [content, hint] of inboxSamples) {
  db.prepare(
    "INSERT INTO inbox_items (id,content,note,type_hint,is_starter,created_at) VALUES (?,?,?,?,1,?)"
  ).run(uid(), content, "Ejemplo — conviérteme o bórrame.", hint, now());
}

/* ── Learn Fast starters (estado idea; Mafer decide cuáles activar) ── */
const learnStarters = [
  ["Inteligencia artificial", "Entender qué puede hacer la IA por mi trabajo y mi vida.", "fundamentos", "evidencia-solida"],
  ["Agentes y skills de Claude", "Aprovechar mis agentes MACA y crear nuevos flujos.", "aplicacion", "evidencia-solida"],
  ["Biotipos", "Explorar el marco de biotipos y qué dice (y no dice) la evidencia.", "exploracion", "marco-tradicional"],
  ["Ventas", "Vender MACA con naturalidad, sin sentirme vendedora.", "aplicacion", "evidencia-limitada"],
  ["Automatizaciones", "Automatizar lo repetitivo de mis flujos de trabajo.", "fundamentos", "evidencia-solida"],
  ["Homeopatía", "Entender el marco tradicional y contrastarlo con la evidencia científica.", "exploracion", "marco-tradicional"],
  ["Storytelling", "Contar historias que conecten en contenido y ventas.", "fundamentos", "evidencia-limitada"],
];
for (const [title, motivation, depth, evidence] of learnStarters) {
  const t = now();
  db.prepare(
    `INSERT INTO learning_topics (id,title,motivation,depth,status,evidence_class,is_starter,created_at,updated_at)
     VALUES (?,?,?,?,'idea',?,1,?,?)`
  ).run(uid(), title, motivation, depth, evidence, t, t);
}

/* ── Ideas de incubadora de ejemplo ── */
db.prepare(
  "INSERT INTO ideas (id,title,description,category,is_starter,created_at,updated_at) VALUES (?,?,?,?,1,?,?)"
).run(uid(), "Ejemplo: ¿maestría o certificación en IA aplicada a salud?", "Una posibilidad, no un compromiso. Investigar opciones cuando haya calma.", "estudio", now(), now());

/* ── Herramientas de IA (guía Qué IA usar) ── */
const tools = [
  ["chatgpt", "ChatGPT", "message-circle", "Conversar, pensar en voz alta, estrategia rápida, borradores.", "Cuando necesitas un primer empujón de ideas o una explicación clara.", "Cuando necesitas trabajar con muchos archivos tuyos o cambios en tu computadora.", "baja", 0, 0, "Texto conversacional: ideas, borradores, explicaciones.", ["Lluvia de ideas para un carrusel", "Explicarme un término médico en simple"]],
  ["chatgpt-projects", "ChatGPT Projects", "folder-open", "Conversaciones con contexto persistente y archivos de un tema.", "Cuando un tema vive semanas y quieres que recuerde el contexto.", "Para tareas de una sola vez o trabajo sobre archivos locales.", "baja", 1, 0, "Chats organizados con memoria de proyecto.", ["Proyecto de contenido mensual con sus briefs"]],
  ["claude-chat", "Claude Chat", "messages-square", "Análisis profundo, redacción cuidadosa, documentos largos.", "Textos delicados, análisis de documentos, razonamiento largo.", "Cuando necesitas que toque archivos o carpetas de tu Mac.", "baja", 1, 0, "Respuestas largas y cuidadosas; artefactos.", ["Revisar el tono de una página completa", "Analizar un contrato (con cautela)"]],
  ["claude-code", "Claude Code", "terminal", "Trabajo real sobre tus archivos: crear, editar, organizar, automatizar, programar.", "Cambios en tus proyectos, vaults, documentos estructurados, apps como esta.", "Charla ligera o preguntas sueltas — para eso usa un chat.", "media", 1, 1, "Archivos creados/modificados en tu computadora, commits, apps.", ["Construir y modificar Mafer OS", "Reorganizar el vault de Obsidian"]],
  ["fable", "Claude Fable 5", "sparkles", "El modelo más capaz de Anthropic; el «cerebro» detrás de Claude Code y Claude Chat.", "Tareas grandes y complejas donde importa la calidad del primer intento.", "No es una app: es el modelo. Lo usas a través de Claude Chat o Claude Code.", "media", 0, 0, "Mejor razonamiento dentro de las apps de Claude.", ["Sesiones largas de construcción como esta"]],
  ["manus", "Manus", "globe", "Agente autónomo para exploración visual y tareas web multipaso.", "Exploración visual de ideas, investigaciones web largas.", "Trabajo sobre tus archivos locales o contenido final de marca.", "media", 0, 0, "Resultados de navegación/exploración autónoma.", ["Explorar referencias visuales para un carrusel"]],
  ["canva", "Canva", "palette", "Diseño final editable: carruseles, PDFs, presentaciones.", "La pieza final que vas a publicar.", "Pensar la estrategia o redactar el copy — hazlo antes, en texto.", "baja", 1, 0, "Diseños terminados listos para publicar.", ["Carrusel MACA a partir del paquete de /maca-producir"]],
  ["imagenes", "Generadores de imagen", "image", "Crear imágenes desde texto (DALL·E, Midjourney, etc.).", "Ilustraciones conceptuales, moodboards, fondos.", "Fotos que deban parecer reales de pacientes o instalaciones — riesgo reputacional.", "baja", 0, 0, "Imágenes generadas.", ["Fondo botánico para una portada"]],
  ["agentes", "Agentes (MACA)", "bot", "Especialistas configurados con reglas de tu negocio (investigar, redactar, auditar…).", "Trabajo MACA que ya tiene agente: usa el comando correspondiente.", "Temas fuera del dominio del agente.", "media", 0, 0, "Entregables estructurados según cada agente.", ["/maca-investigar dolor de rodilla", "/maca-auditar (antes de publicar)"]],
  ["skills", "Skills", "wrench", "Instrucciones reutilizables que un modelo carga para una tarea concreta.", "Flujos repetibles con reglas fijas (ej. fable-playbook).", "Cosas de una sola vez.", "media", 0, 0, "Comportamiento consistente del modelo en esa tarea.", ["Cargar fable-playbook en decisiones de desarrollo"]],
  ["terminal", "Flujos de terminal", "square-chevron-right", "Comandos y scripts que corren en tu Mac (npm run backup, git…).", "Respaldos, sincronizar el vault, actualizar la app.", "Si un botón de la app ya lo hace, usa el botón.", "alta", 0, 1, "Acciones ejecutadas en tu sistema.", ["npm run backup", "npm run sync:obsidian"]],
];
tools.forEach((t, i) => {
  db.prepare(
    `INSERT INTO ai_tools (id,name,icon,best_for,when_to_use,when_not_to_use,complexity,needs_files,involves_code,expected_output,examples,position)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(t[0], t[1], t[2], t[3], t[4], t[5], t[6], t[7], t[8], t[9], JSON.stringify(t[10]), i);
});

/* ── Agentes, comandos y skills reales de MACA (inventario de solo lectura) ── */
const A = "~/Desktop/MACA Medical Journey/.claude";
const agents = [
  ["maca-orchestrator", "agente", "Orquestador del flujo MACA: te dice qué comando y agente usar, en qué parte del pipeline estás y qué sigue.", "Tu duda o tarea de contenido", "Guía en español del camino correcto", "Cuando no sabes por dónde empezar un trabajo de MACA.", "Nunca produce contenido final ni se salta la auditoría.", "", ["maca-researcher","maca-content-strategist","maca-calm-authority-writer","maca-clinical-brand-auditor","maca-visual-asset-curator"], `${A}/agents/maca-orchestrator.md`],
  ["maca-researcher", "agente", "Investiga preocupaciones, objeciones y barreras de confianza de pacientes ortopédicos internacionales; propone ángulos educativos seguros.", "Tema o pregunta a investigar", "Tabla de investigación estructurada en español", "Antes de planear o escribir contenido nuevo.", "No escribe copy final ni inventa estadísticas.", "/maca-investigar", ["maca-content-strategist"], `${A}/agents/maca-researcher.md`],
  ["maca-content-strategist", "agente", "Convierte investigación e ideas en planes: calendarios, series y tablas de ideas con pilares y niveles de riesgo.", "Investigación o prioridad de negocio", "Tabla de ideas / calendario en español", "Para decidir qué contenido hacer y en qué orden.", "No redacta el copy final.", "/maca-planear", ["maca-researcher","maca-calm-authority-writer"], `${A}/agents/maca-content-strategist.md`],
  ["maca-calm-authority-writer", "agente", "Copywriter en inglés con la voz «Calm Authority»: carruseles, reels, captions, web. Notas internas en español.", "Brief o idea aprobada", "Copy público final en inglés", "Para redactar la pieza cuando la idea ya está clara.", "Tiene lista de lenguaje prohibido (safe surgery, guaranteed…). Nunca promete resultados.", "/maca-redactar", ["maca-clinical-brand-auditor"], `${A}/agents/maca-calm-authority-writer.md`],
  ["maca-clinical-brand-auditor", "agente", "Audita tono, claridad, claims médicos, riesgo legal y alineación de marca. Veredicto: Approved / Revise / Blocked.", "Contenido listo para revisar", "Auditoría estructurada en español con reescrituras", "SIEMPRE antes de publicar cualquier contenido MACA.", "No es el paso de creación; no lo uses para redactar desde cero.", "/maca-auditar", ["maca-calm-authority-writer"], `${A}/agents/maca-clinical-brand-auditor.md`],
  ["maca-visual-asset-curator", "agente", "Cura fotos/videos reales de MACA: riesgo, privacidad, consentimiento y usos seguros, con ficha de 18 campos.", "Assets visuales (fotos, videos)", "Curación estructurada en español por asset", "Antes de usar material visual en contenido.", "Nunca edita, mueve, borra ni publica assets.", "/maca-curar-assets", ["maca-content-strategist"], `${A}/agents/maca-visual-asset-curator.md`],
  ["maca-senior-consultant", "agente", "Consultor estratégico senior: decisiones de negocio, posicionamiento, precios, prioridades y conversaciones con socios.", "Una decisión o dilema de negocio", "Consejo estratégico estructurado en español", "Para pensar decisiones importantes de MACA.", "No es agente médico, legal ni de contenido.", "", ["maca-orchestrator"], `${A}/agents/maca-senior-consultant.md`],
  ["maca-legal-policy-assistant", "agente", "Apoyo legal/políticas: contratos, privacidad, cancelaciones, disclaimers, consentimiento, términos de pago.", "Texto o duda legal/política", "Guía conservadora de riesgo en español", "Al revisar lenguaje legal o de políticas.", "No es abogado; no da consejo legal final.", "", [], `${A}/agents/maca-legal-policy-assistant.md`],
  ["maca-web-framer-seo-assistant", "agente", "Web, Framer, SEO y visibilidad en buscadores de IA (AEO/GEO): metadata, FAQ, JSON-LD, llms.txt, enlazado interno.", "Página o duda del sitio web", "Guía estructurada de sitio web en español", "Para mejorar el sitio de MACA y su visibilidad.", "No inventa claims ni publica sin que se lo pidas.", "", [], `${A}/agents/maca-web-framer-seo-assistant.md`],
  ["maca-crear-contenido", "comando", "Pipeline maestro: ejecuta investigador → estratega → escritor → auditor en secuencia para una solicitud.", "Solicitud de contenido", "Pieza completa que pasó por los 4 agentes", "Para crear una pieza completa de principio a fin.", "Si solo necesitas un paso, usa el comando de ese paso.", "/maca-crear-contenido", ["maca-researcher","maca-content-strategist","maca-calm-authority-writer","maca-clinical-brand-auditor"], `${A}/commands/maca-crear-contenido.md`],
  ["maca-producir", "comando", "Convierte una pieza Approved en paquete de producción visual listo para Canva.", "Pieza aprobada por /maca-auditar", "Especificaciones de diseño para Canva", "Después de la auditoría, antes de diseñar.", "No diseña en Canva directamente.", "/maca-producir", ["maca-clinical-brand-auditor"], `${A}/commands/maca-producir.md`],
  ["maca-render-preview", "comando", "Genera previews visuales locales (SVG/HTML) de una pieza aprobada para ver la composición antes de Canva.", "Pieza Approved o Ready for Canva", "Previews SVG/HTML locales", "Para visualizar antes de invertir tiempo en Canva.", "No sustituye el diseño final.", "/maca-render-preview", ["maca-producir"], `${A}/commands/maca-render-preview.md`],
  ["fable-playbook", "skill", "Hábitos de razonamiento de Fable 5 destilados como instrucciones directas para desarrollo, análisis y decisiones.", "Se carga al inicio de una tarea", "Comportamiento más riguroso del modelo", "En tareas de desarrollo o decisiones donde importa la calidad del primer intento.", "No es un agente; no ejecuta nada por sí solo.", "", [], `${A}/skills/fable-playbook/SKILL.md`],
];
for (const [name, kind, purpose, input, output, when, whenNot, command, rels, srcPath] of agents) {
  db.prepare(
    `INSERT INTO agents_skills (id,name,kind,source,purpose,input,output,when_to_use,when_not_to_use,command,relationships,source_path,status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'activo')`
  ).run(uid(), name, kind, "MACA", purpose, input, output, when, whenNot, command, JSON.stringify(rels), srcPath);
}

/* ── Prompts maestros de ejemplo (seguros, sin datos sensibles) ── */
const prompts = [
  ["Investigar tema para MACA", "/maca-investigar [tema]\n\nEjemplo:\n/maca-investigar preocupaciones de pacientes de EE.UU. sobre cirugía de cadera en México", "claude-code", "maca", "Obtener la tabla de investigación estructurada antes de crear contenido.", "Ninguno (el agente lee el repo de MACA)", "Tabla: Código / Tema / Preocupación / Insight / Fuente / Oportunidad / Formato / Riesgo / Notas"],
  ["Crear pieza completa de contenido MACA", "/maca-crear-contenido [descripción de la pieza]\n\nEjemplo:\n/maca-crear-contenido carrusel sobre cómo elegir cirujano ortopédico siendo paciente internacional", "claude-code", "maca", "Ejecutar el pipeline completo: investigar → planear → redactar → auditar.", "Ninguno", "Pieza final auditada con veredicto"],
  ["Auditar antes de publicar", "/maca-auditar [pega aquí el contenido]", "claude-code", "maca", "Verificar tono, claims y riesgo legal antes de publicar cualquier cosa de MACA.", "El contenido a auditar", "Veredicto Approved / Revise / Blocked + reescrituras"],
  ["Resumir un documento largo", "Te voy a pegar un documento largo. Resúmelo en:\n1) 5 puntos clave\n2) decisiones que requiere de mí\n3) preguntas abiertas\n\nUsa lenguaje simple en español.\n\n[pega el documento]", "claude-chat", "general", "Digerir PDFs o textos largos rápido.", "El documento (pegado o adjunto)", "Resumen accionable en 3 bloques"],
  ["Pensar una decisión difícil", "Ayúdame a pensar esta decisión como consultor honesto.\n\nDecisión: [descríbela]\nOpciones que veo: [lista]\nMe preocupa: [lista]\n\n1) hazme máximo 5 preguntas que me falten\n2) dame pros/contras por opción\n3) dime qué harías tú y por qué\n4) dime qué señal me diría en 30 días si elegí mal", "chatgpt", "general", "Estructurar decisiones personales o de negocio.", "Ninguno", "Análisis + recomendación + señal de revisión"],
  ["Mejorar un prompt", "Este es mi borrador de prompt. Reescríbelo para que sea claro, completo y difícil de malinterpretar. Devuélveme solo el prompt final listo para copiar.\n\n[pega tu borrador]", "claude-chat", "prompts", "Convertir ideas sueltas en prompts precisos (o usa el agente prompt-architect en Claude Code).", "Tu borrador", "Prompt final pulido"],
];
for (const [title, body, tool, category, purpose, files, output] of prompts) {
  const t = now();
  db.prepare(
    `INSERT INTO prompts (id,title,body,tool,category,purpose,required_files,expected_output,version,is_starter,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,'1.0',1,?,?)`
  ).run(uid(), title, body, tool, category, purpose, files, output, t, t);
}

/* ── Recursos de ejemplo ── */
db.prepare(
  `INSERT INTO resources (id,title,type,url,topic,notes,is_starter,created_at) VALUES (?,?,?,?,?,?,1,?)`
).run(uid(), "Documentación de Claude Code", "sitio", "https://docs.anthropic.com/claude-code", "ia", "Referencia oficial para modificar Mafer OS con Claude Code.", now());

db.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('seeded','1',?)").run(now());
console.log("Seed completado ✅");
