/* Motor «Haz esto ahora» y alertas antiolvido — Fase 3.
   Módulo puro y transparente: puntúa con reglas explicables (nada de cajas
   negras) y siempre dice POR QUÉ recomienda algo. Pensado para TDAH: una sola
   respuesta clara en menos de diez segundos, sin saturar. */

export type RecommendTask = {
  id: string;
  title: string;
  duration: string | null; // under_10|ten_to_30|thirty_to_60|over_60|null
  energy: string | null; // low|medium|high|null (energía REQUERIDA)
  dueDate: string | null;
  priority: string | null; // baja|media|alta
  columnKind?: string | null;
  blockedReason?: string | null;
  waitingFor?: string | null;
  createdAt: string;
};

export type Recommendation = { id: string; score: number; reasons: string[] };

/** Tareas que no tiene sentido recomendar ahora: bloqueadas, en espera o pospuestas. */
function esAccionable(t: RecommendTask): boolean {
  if (t.blockedReason || t.columnKind === "bloqueado") return false;
  if (t.waitingFor || t.columnKind === "esperando") return false;
  if (t.columnKind === "despues") return false;
  return true;
}

/** Recomienda qué hacer ahora. Devuelve hasta `limit` candidatas ordenadas,
 *  cada una con sus razones en lenguaje claro (máximo 3). */
export function recommendNow(opts: {
  tasks: RecommendTask[];
  dayEnergy: string; // "baja" | "media" | "alta" | "" (energía del DÍA de Mafer)
  priorityIds: string[]; // las 3 prioridades manuales, en orden
  today: string; // YYYY-MM-DD
  limit?: number;
}): Recommendation[] {
  const { tasks, dayEnergy, priorityIds, today } = opts;
  const limit = opts.limit ?? 3;

  const scored = tasks.filter(esAccionable).map((t) => {
    let score = 0;
    const reasons: string[] = [];

    // 1) Tus prioridades manuales mandan (en su orden)
    const pIdx = priorityIds.indexOf(t.id);
    if (pIdx >= 0) {
      score += 100 - pIdx * 8;
      reasons.push(`es tu prioridad #${pIdx + 1} de hoy`);
    }

    // 2) Fechas: lo vencido y lo de hoy no se pueden olvidar
    if (t.dueDate) {
      if (t.dueDate < today) {
        score += 70;
        reasons.push(`venció el ${t.dueDate}`);
      } else if (t.dueDate === today) {
        score += 60;
        reasons.push("vence hoy");
      }
    }

    // 3) Cruce energía del día × energía requerida por la tarea
    if (dayEnergy === "baja") {
      if (t.energy === "low") {
        score += 25;
        reasons.push("pide energía baja, como la tuya hoy");
      } else if (t.energy === null) score += 8;
      else if (t.energy === "medium") score -= 5;
      else if (t.energy === "high") score -= 30; // mejor para un día con más pila
      if (t.duration === "under_10") {
        score += 12;
        reasons.push("toma menos de 10 minutos");
      } else if (t.duration === "ten_to_30") score += 6;
      else if (t.duration === "over_60") score -= 10;
    } else if (dayEnergy === "media") {
      if (t.energy === "medium") {
        score += 15;
        reasons.push("va bien con tu energía media");
      } else if (t.energy === "low") score += 8;
      else if (t.energy === null) score += 5;
      else if (t.energy === "high") score -= 8;
    } else if (dayEnergy === "alta") {
      if (t.energy === "high") {
        score += 25;
        reasons.push("aprovecha tu energía alta");
      } else if (t.energy === "medium") score += 8;
      if (t.duration === "over_60") {
        score += 10;
        reasons.push("es trabajo profundo");
      }
    }

    // 4) Prioridad alta marcada por Mafer
    if (t.priority === "alta") {
      score += 12;
      reasons.push("la marcaste con prioridad alta");
    }

    // 5) Victorias rápidas ayudan a arrancar (leve, para desempatar)
    if (dayEnergy !== "baja" && t.duration === "under_10") score += 4;

    return { id: t.id, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((r) => ({
    ...r,
    reasons: r.reasons.length ? r.reasons.slice(0, 3) : ["es un buen siguiente paso pendiente"],
  }));
}

/* ── Alertas antiolvido ──────────────────────────────────────────────
   Cosas que se caen por los huecos cuando hay TDAH. Cada alerta lleva a la
   acción con un clic. Se muestran pocas y ordenadas por urgencia. */

export type ForgetAlert = {
  kind:
    | "tarea-vencida"
    | "esperando-mucho"
    | "proyecto-sin-accion"
    | "proyecto-inactivo"
    | "hoy-sin-estimar"
    | "inbox-olvidado";
  text: string;
  href: string;
};

export type AlertInputs = {
  today: string;
  /** Tareas abiertas (no archivadas ni terminadas). */
  tasks: (RecommendTask & { updatedAt: string })[];
  /** Proyectos activos y no archivados. */
  projects: { id: string; title: string; nextAction: string | null; lastActivity: string }[];
  /** Capturas del Inbox sin procesar. */
  inbox: { id: string; createdAt: string }[];
  /** Ids de tareas que son prioridad de hoy. */
  priorityIds: string[];
};

const DIAS_ESPERANDO = 7;
const DIAS_PROYECTO_INACTIVO = 14;
const DIAS_INBOX = 3;

export function diasEntre(desdeIso: string, hastaYmd: string): number {
  const desde = desdeIso.slice(0, 10);
  const a = new Date(`${desde}T00:00:00`);
  const b = new Date(`${hastaYmd}T00:00:00`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

/** Construye las alertas antiolvido, ordenadas por urgencia y limitadas a `limit`. */
export function buildForgetAlerts(input: AlertInputs, limit = 5): ForgetAlert[] {
  const { today, tasks, projects, inbox, priorityIds } = input;
  const alerts: ForgetAlert[] = [];

  // 1) Tareas vencidas (lo más urgente)
  const vencidas = tasks.filter((t) => t.dueDate && t.dueDate < today);
  if (vencidas.length) {
    alerts.push({
      kind: "tarea-vencida",
      text:
        vencidas.length === 1
          ? `«${vencidas[0].title}» venció el ${vencidas[0].dueDate}`
          : `${vencidas.length} tareas vencidas esperan una decisión`,
      href: vencidas.length === 1 ? `/tareas?abrir=${vencidas[0].id}` : "/tareas?f=confecha",
    });
  }

  // 2) Esperando demasiado tiempo
  const esperandoMucho = tasks
    .filter((t) => (t.waitingFor || t.columnKind === "esperando") && diasEntre(t.updatedAt, today) >= DIAS_ESPERANDO)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  for (const t of esperandoMucho.slice(0, 2)) {
    alerts.push({
      kind: "esperando-mucho",
      text: `«${t.title}» lleva ${diasEntre(t.updatedAt, today)} días esperando${t.waitingFor ? ` a ${t.waitingFor}` : ""} — ¿un empujoncito?`,
      href: `/tareas?abrir=${t.id}`,
    });
  }

  // 3) Proyecto activo sin siguiente acción definida
  for (const p of projects.filter((p) => !(p.nextAction ?? "").trim()).slice(0, 2)) {
    alerts.push({
      kind: "proyecto-sin-accion",
      text: `«${p.title}» no tiene siguiente acción — así se pierden los proyectos`,
      href: `/proyectos/${p.id}`,
    });
  }

  // 4) Proyecto activo sin actividad reciente
  for (const p of projects
    .filter((p) => diasEntre(p.lastActivity, today) >= DIAS_PROYECTO_INACTIVO)
    .slice(0, 2)) {
    alerts.push({
      kind: "proyecto-inactivo",
      text: `«${p.title}» lleva ${diasEntre(p.lastActivity, today)} días sin movimiento`,
      href: `/proyectos/${p.id}?retomar=1`,
    });
  }

  // 5) Tareas de hoy (fecha de hoy o prioridad) sin duración o energía
  const sinEstimar = tasks.filter(
    (t) => (t.dueDate === today || priorityIds.includes(t.id)) && (!t.duration || !t.energy)
  );
  if (sinEstimar.length) {
    alerts.push({
      kind: "hoy-sin-estimar",
      text:
        sinEstimar.length === 1
          ? `«${sinEstimar[0].title}» es de hoy y no tiene duración o energía`
          : `${sinEstimar.length} tareas de hoy no tienen duración o energía`,
      href: `/tareas?abrir=${sinEstimar[0].id}`,
    });
  }

  // 6) Capturas olvidadas en el Inbox
  if (inbox.length) {
    const masVieja = [...inbox].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    const dias = diasEntre(masVieja.createdAt, today);
    if (dias >= DIAS_INBOX) {
      alerts.push({
        kind: "inbox-olvidado",
        text: `Hay ${inbox.length === 1 ? "una captura" : `${inbox.length} capturas`} en el Inbox; la más antigua lleva ${dias} días`,
        href: "/inbox",
      });
    }
  }

  return alerts.slice(0, limit);
}
