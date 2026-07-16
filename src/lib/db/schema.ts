import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/** Clave-valor para configuración local: hash de contraseña, nombre, energía del día,
 *  tokens de Google (solo servidor), estado del onboarding. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").default(""),
  objective: text("objective").default(""),
  area: text("area").default("personal"), // personal | profesional | aprendizaje | familia
  status: text("status").notNull().default("activo"), // activo | pausado | esperando | terminado | archivado
  priority: text("priority").default("media"), // baja | media | alta
  health: text("health").default("bien"), // bien | atencion | riesgo
  nextAction: text("next_action").default(""), // texto heredado; si hay tarjeta vinculada, manda la tarjeta
  nextActionCardId: text("next_action_card_id"), // la siguiente acción como TAREA REAL (sin FK: se valida en código)
  resumeNote: text("resume_note").default(""), // «Contexto para retomar» editado a mano
  startDate: text("start_date"),
  targetDate: text("target_date"),
  color: text("color").default("sage"),
  icon: text("icon").default("folder"),
  links: text("links", { mode: "json" }).$type<{ label: string; url: string }[]>().default([]),
  notes: text("notes").default(""),
  isStarter: integer("is_starter", { mode: "boolean" }).default(false),
  archived: integer("archived", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const boards = sqliteTable("boards", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Tablero"),
  prefs: text("prefs", { mode: "json" }).$type<{ density?: string }>().default({}),
});

export const columns = sqliteTable("columns", {
  id: text("id").primaryKey(),
  boardId: text("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("custom"), // backlog|proximo|proceso|esperando|bloqueado|despues|terminado|custom
  position: integer("position").notNull().default(0),
});

export type ChecklistItem = { id: string; text: string; done: boolean };

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").default(""),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  boardId: text("board_id").references(() => boards.id, { onDelete: "cascade" }),
  columnId: text("column_id").references(() => columns.id, { onDelete: "set null" }),
  position: integer("position").notNull().default(0),
  type: text("type").notNull().default("tarea"), // tarea|idea|pregunta|decision|recurso|aprendizaje|seguimiento
  priority: text("priority").default("media"),
  duration: text("duration"), // under_10|ten_to_30|thirty_to_60|over_60|null (sin estimar) — ver src/lib/estimates.ts
  energy: text("energy"), // low|medium|high|null (sin estimar) — energía REQUERIDA por la tarea, no la del día
  dueDate: text("due_date"),
  startTime: text("start_time"), // HH:MM
  reminder: text("reminder"), // none | gcal-timed | gcal-allday
  nextAction: text("next_action").default(""),
  blockedReason: text("blocked_reason").default(""),
  waitingFor: text("waiting_for").default(""),
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  checklist: text("checklist", { mode: "json" }).$type<ChecklistItem[]>().default([]),
  links: text("links", { mode: "json" }).$type<{ label: string; url: string }[]>().default([]),
  gcalEventId: text("gcal_event_id"),
  isStarter: integer("is_starter", { mode: "boolean" }).default(false),
  archived: integer("archived", { mode: "boolean" }).default(false),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Las 3 prioridades del día. */
export const todayPriorities = sqliteTable("today_priorities", {
  id: text("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD
  cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
});

export const inboxItems = sqliteTable("inbox_items", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  note: text("note").default(""),
  typeHint: text("type_hint"), // tarea|idea|proyecto|aprendizaje|journal|decision|recurso
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  date: text("date"),
  processed: integer("processed", { mode: "boolean" }).default(false),
  convertedTo: text("converted_to"), // "tipo:id"
  isStarter: integer("is_starter", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull(),
});

export const journalEntries = sqliteTable("journal_entries", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").default(""),
  date: text("date").notNull(),
  mood: text("mood"), // opcional
  energy: text("energy"),
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  learningId: text("learning_id"),
  templateType: text("template_type").default("libre"), // libre|diaria|semanal|proyecto|decision|aprendizaje|gratitud
  favorite: integer("favorite", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const learningTopics = sqliteTable("learning_topics", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  motivation: text("motivation").default(""),
  outcome: text("outcome").default(""), // qué significa "suficientemente bueno"
  depth: text("depth").default("exploracion"), // exploracion|fundamentos|aplicacion|dominio
  status: text("status").notNull().default("idea"), // idea|activo|pausado|terminado|archivado
  keyQuestions: text("key_questions", { mode: "json" }).$type<string[]>().default([]),
  sprint: text("sprint", { mode: "json" })
    .$type<{ goal?: string; start?: string; end?: string; steps?: ChecklistItem[] }>()
    .default({}),
  notes: text("notes").default(""),
  exercises: text("exercises", { mode: "json" }).$type<ChecklistItem[]>().default([]),
  evidenceClass: text("evidence_class").default("sin-clasificar"),
  // evidencia-solida | evidencia-limitada | marco-tradicional | hipotesis | reflexion-personal | sin-clasificar
  result: text("result").default(""),
  progress: integer("progress").default(0), // 0-100
  reviewDate: text("review_date"),
  isStarter: integer("is_starter", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const ideas = sqliteTable("ideas", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").default(""),
  category: text("category").default("general"), // proyecto|estudio|negocio|experimento|general
  status: text("status").notNull().default("incubando"), // incubando|algun-dia|graduada|archivada|rechazada
  graduatedTo: text("graduated_to"), // "tipo:id"
  isStarter: integer("is_starter", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const prompts = sqliteTable("prompts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  tool: text("tool").default("claude-code"),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  category: text("category").default("general"),
  purpose: text("purpose").default(""),
  requiredFiles: text("required_files").default(""),
  expectedOutput: text("expected_output").default(""),
  version: text("version").default("1.0"),
  notes: text("notes").default(""),
  favorite: integer("favorite", { mode: "boolean" }).default(false),
  isStarter: integer("is_starter", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const aiTools = sqliteTable("ai_tools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").default("sparkles"),
  bestFor: text("best_for").default(""),
  whenToUse: text("when_to_use").default(""),
  whenNotToUse: text("when_not_to_use").default(""),
  complexity: text("complexity").default("baja"), // baja|media|alta
  needsFiles: integer("needs_files", { mode: "boolean" }).default(false),
  involvesCode: integer("involves_code", { mode: "boolean" }).default(false),
  expectedOutput: text("expected_output").default(""),
  examples: text("examples", { mode: "json" }).$type<string[]>().default([]),
  position: integer("position").default(0),
});

export const agentsSkills = sqliteTable("agents_skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // agente|skill|comando
  source: text("source").default("MACA"),
  purpose: text("purpose").default(""),
  input: text("input").default(""),
  output: text("output").default(""),
  whenToUse: text("when_to_use").default(""),
  whenNotToUse: text("when_not_to_use").default(""),
  command: text("command").default(""),
  relationships: text("relationships", { mode: "json" }).$type<string[]>().default([]),
  sourcePath: text("source_path").default(""),
  status: text("status").default("activo"), // activo|experimental|planeado|deprecado|no-encontrado
  scope: text("scope").default("maca"), // maca|global|mafer-os|otro
  fileModified: text("file_modified"), // fecha de última modificación del archivo fuente
});

export const decisions = sqliteTable("decisions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  context: text("context").default(""),
  decision: text("decision").default(""),
  reason: text("reason").default(""),
  consequences: text("consequences").default(""),
  replaces: text("replaces").default(""),
  reviewDate: text("review_date"),
  createdAt: text("created_at").notNull(),
});

export const resources = sqliteTable("resources", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").default("articulo"), // video|articulo|sitio|libro|documento|curso|archivo|herramienta
  url: text("url").default(""),
  topic: text("topic").default(""),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  learningId: text("learning_id"),
  notes: text("notes").default(""),
  status: text("status").default("pendiente"), // pendiente|en-proceso|revisado
  favorite: integer("favorite", { mode: "boolean" }).default(false),
  isStarter: integer("is_starter", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull(),
});

/** Eventos de calendario propios (reuniones, fechas importantes) no ligados a una tarjeta. */
export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  type: text("type").default("evento"), // evento|reunion|deadline|recordatorio
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  notes: text("notes").default(""),
  gcalEventId: text("gcal_event_id"),
  isStarter: integer("is_starter", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull(),
});

/** Sesiones de revisión (diaria/semanal): progreso guardado e historial simple. */
export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // diaria | semanal
  date: text("date").notNull(), // YYYY-MM-DD de inicio
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"), // null = en curso / incompleta
  completed: integer("completed", { mode: "boolean" }).default(false),
  step: integer("step").notNull().default(1),
  processed: integer("processed").notNull().default(0),
  summary: text("summary").default(""),
  meta: text("meta", { mode: "json" }).$type<{ inboxStart?: number }>().default({}),
});

/** Focus Garden (Fase 7B): sesiones de enfoque vinculadas (opcionalmente) a una
 *  tarea real. La fuente de verdad del tiempo son los timestamps persistidos
 *  (phase_started_at + segundos consolidados), nunca un contador en memoria.
 *  finished_at null = sesión abierta/recuperable (mismo patrón que reviews). */
export const focusSessions = sqliteTable("focus_sessions", {
  id: text("id").primaryKey(),
  cardId: text("card_id"), // referencia blanda a cards (como next_action_card_id)
  preset: text("preset").notNull(), // arranque|ligero|pomodoro|profundo|personalizado
  plannedFocusMin: integer("planned_focus_min").notNull(),
  plannedBreakMin: integer("planned_break_min").notNull().default(0),
  phase: text("phase").notNull(), // enfoque|pausado|enfoque-listo|descanso|descanso-pausado
  phaseStartedAt: text("phase_started_at").notNull(), // inicio ISO de la fase actual
  elapsedFocusSeconds: integer("elapsed_focus_seconds").notNull().default(0), // consolidado en cada transición
  elapsedBreakSeconds: integer("elapsed_break_seconds").notNull().default(0),
  date: text("date").notNull(), // YYYY-MM-DD (para el acumulado diario)
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"), // null = abierta/recuperable
  outcome: text("outcome"), // completa|terminada-antes|descartada
  creditedMinutes: integer("credited_minutes").notNull().default(0), // minutos abonados a la planta al cerrar
  createdAt: text("created_at").notNull(),
});

/** La planta actual y el jardín: progreso acumulativo por planta, sin reloj,
 *  sin decaimiento. La etapa se DERIVA de accumulated_minutes (focus-logic.ts).
 *  completed_at null = planta actual; al completarse pasa al jardín y nace otra. */
export const focusPlants = sqliteTable("focus_plants", {
  id: text("id").primaryKey(),
  species: text("species").notNull().default("brote-comun"), // única especie en v1
  accumulatedMinutes: integer("accumulated_minutes").notNull().default(0),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
});

export const recentViews = sqliteTable("recent_views", {
  id: text("id").primaryKey(), // `${type}:${entityId}`
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  title: text("title").notNull(),
  href: text("href").notNull(),
  viewedAt: text("viewed_at").notNull(),
});
