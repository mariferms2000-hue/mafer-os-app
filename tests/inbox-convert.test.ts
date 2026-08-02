import { describe, expect, it, beforeEach, vi } from "vitest";

/* Procesar una captura del Inbox: qué se escribe y qué NO.
 *
 * La «siguiente acción» es un concepto de PROYECTO (ver NextActionBlock y
 * NextActionPicker). El detalle de una tarea no la muestra ni la deja editar,
 * así que el flujo «captura → tarea» no debe persistir nada en
 * cards.next_action: sería un dato huérfano, invisible e ineditable.
 *
 * Estas pruebas no tocan la base: sustituyen `@/lib/db` por un grabador de
 * operaciones, así que son deterministas y no necesitan DATABASE_URL. */

const h = vi.hoisted(() => {
  type WriteOp = { kind: "insert" | "update"; table: unknown; values: Record<string, unknown> };
  const ops: WriteOp[] = [];
  const created: Record<string, unknown>[] = [];
  const state: { selectResult: unknown[] } = { selectResult: [] };
  return { ops, created, state };
});

vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("../src/lib/db/schema")>("../src/lib/db/schema");

  const selectChain = () => {
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: () => Promise.resolve(h.state.selectResult),
    };
    return chain;
  };

  const db = {
    select: () => selectChain(),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        h.ops.push({ kind: "insert", table, values });
        return Promise.resolve();
      },
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        h.ops.push({ kind: "update", table, values });
        return { where: () => Promise.resolve() };
      },
    }),
    delete: () => ({ where: () => Promise.resolve() }),
  };

  return {
    db,
    schema,
    now: () => "2026-08-02T10:00:00.000Z",
    today: () => "2026-08-02",
    uid: () => "generado-1",
  };
});

vi.mock("@/lib/auth", () => ({ requireAuth: () => Promise.resolve() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/db/helpers", () => ({
  createCardInColumnKind: (input: Record<string, unknown>) => {
    h.created.push(input);
    return Promise.resolve("card-1");
  },
  createDefaultBoard: () => Promise.resolve(),
}));

const { convertInboxItem } = await import("../src/lib/actions/inbox");
const schema = await import("../src/lib/db/schema");

const CAPTURA = {
  id: "inbox-1",
  content: "Renovar el pasaporte",
  note: "Antes del viaje",
  projectId: null,
  date: null,
};

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** Todas las claves escritas sobre una tabla concreta, en cualquier operación. */
function valuesFor(table: unknown): Record<string, unknown>[] {
  return h.ops.filter((o) => o.table === table).map((o) => o.values);
}

beforeEach(() => {
  h.ops.length = 0;
  h.created.length = 0;
  h.state.selectResult = [CAPTURA];
});

describe("convertInboxItem — captura procesada como TAREA", () => {
  it("no persiste nextAction aunque llegue en el formulario", async () => {
    const res = await convertInboxItem(
      form({ id: "inbox-1", target: "tarea", nextAction: "El primer paso visible" })
    );

    expect(res).toEqual({ convertedTo: "tarea:card-1" });
    // Ninguna escritura sobre cards: la tarjeta se crea vía createCardInColumnKind
    // y nada la actualiza después.
    expect(valuesFor(schema.cards)).toEqual([]);
    // Y por si alguna ruta futura escribiera cards indirectamente: ninguna
    // operación de esta conversión lleva la clave nextAction.
    expect(h.ops.some((o) => "nextAction" in o.values)).toBe(false);
    expect(h.created.some((c) => "nextAction" in c)).toBe(false);
  });

  it("sigue creando la tarea con sus campos propios", async () => {
    await convertInboxItem(
      form({ id: "inbox-1", target: "tarea", projectId: "proj-9", date: "2026-08-10", nextAction: "algo" })
    );

    expect(h.created).toHaveLength(1);
    expect(h.created[0]).toMatchObject({
      title: "Renovar el pasaporte",
      description: "Antes del viaje",
      projectId: "proj-9",
      columnKind: "proximo",
      dueDate: "2026-08-10",
    });
  });

  it("marca la captura como procesada", async () => {
    await convertInboxItem(form({ id: "inbox-1", target: "tarea", nextAction: "algo" }));

    expect(valuesFor(schema.inboxItems)).toEqual([
      { processed: true, convertedTo: "tarea:card-1", content: "Renovar el pasaporte", note: "Antes del viaje" },
    ]);
  });
});

describe("convertInboxItem — captura procesada como PROYECTO", () => {
  it("crea el proyecto con su objetivo, sin tocar la siguiente acción", async () => {
    const res = await convertInboxItem(
      form({ id: "inbox-1", target: "proyecto", objective: "Pasaporte en la mano" })
    );

    expect(res).toEqual({ convertedTo: "proyecto:generado-1" });
    const [proyecto] = valuesFor(schema.projects);
    expect(proyecto).toMatchObject({
      id: "generado-1",
      title: "Renovar el pasaporte",
      description: "Antes del viaje",
      objective: "Pasaporte en la mano",
    });
    // La «siguiente acción» de un proyecto NO se define al procesar la captura:
    // es responsabilidad de NextActionBlock / NextActionPicker en el detalle del
    // proyecto, que sabe vincular una tarea real. Este flujo la deja intacta.
    expect("nextAction" in proyecto).toBe(false);
    expect("nextActionCardId" in proyecto).toBe(false);
  });

  it("ignora un nextAction suelto en el formulario", async () => {
    await convertInboxItem(
      form({ id: "inbox-1", target: "proyecto", objective: "Listo", nextAction: "Pedir cita" })
    );

    expect(h.ops.some((o) => "nextAction" in o.values)).toBe(false);
  });
});
