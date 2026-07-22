"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Clock, Ban, Hourglass, CalendarClock, ListChecks, MoreHorizontal, Trash2, CheckCircle2 } from "lucide-react";
import { moveCardAction, createCardInColumnAction, deleteCardAction, completeCardAction } from "@/lib/actions/cards";
import { useToast } from "@/components/ui/toast";
import { openTaskUrl } from "@/components/tasks/task-detail";
import { durationShort } from "@/lib/estimates";
import type { ChecklistItem } from "@/lib/db/schema";

export type BoardColumn = { id: string; title: string; kind: string };

export type BoardCard = {
  id: string;
  title: string;
  description: string | null;
  columnId: string | null;
  position: number;
  type: string;
  priority: string | null;
  duration: string | null;
  energy: string | null;
  dueDate: string | null;
  startTime: string | null;
  reminder: string | null;
  nextAction: string | null;
  blockedReason: string | null;
  waitingFor: string | null;
  tags: string[] | null;
  checklist: ChecklistItem[] | null;
  completedAt: string | null;
};

const KIND_ACCENT: Record<string, string> = {
  bloqueado: "border-t-blocked/50",
  esperando: "border-t-waiting/50",
  terminado: "border-t-done/60",
  proceso: "border-t-sage-deep/60",
};

type ItemsMap = Record<string, BoardCard[]>;

/**
 * Tablero estable para Safari/WebKit:
 * - La tarjeta activa NUNCA cambia de contenedor durante el arrastre (evita que WebKit
 *   destruya el nodo con pointer capture — causa del crash "This page couldn't load").
 * - El movimiento se calcula y aplica únicamente en onDragEnd.
 * - Persistencia con snapshot + rollback + aviso si el guardado falla.
 */
export function Board({
  columns,
  cards,
  nextActionCardId = null,
}: {
  columns: BoardColumn[];
  cards: BoardCard[];
  /** Tarjeta marcada discretamente como la siguiente acción del proyecto. */
  nextActionCardId?: string | null;
}) {
  const [items, setItems] = useState<ItemsMap>({});
  const [active, setActive] = useState<BoardCard | null>(null);
  const [targetCol, setTargetCol] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const dragging = useRef(false);
  const justDragged = useRef(false);
  const toast = useToast();

  useEffect(() => {
    if (dragging.current) return; // no pisar el estado mientras se arrastra
    const map: ItemsMap = {};
    for (const col of columns) map[col.id] = [];
    for (const c of cards) {
      if (c.columnId && map[c.columnId]) map[c.columnId].push(c);
    }
    for (const id of Object.keys(map)) map[id].sort((a, b) => a.position - b.position);
    setItems(map);
  }, [columns, cards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const cardById = useMemo(() => {
    const m = new Map<string, BoardCard>();
    Object.values(items).flat().forEach((c) => m.set(c.id, c));
    return m;
  }, [items]);

  function findColumn(id: string): string | undefined {
    if (items[id]) return id; // es una columna
    return Object.keys(items).find((colId) => items[colId].some((c) => c.id === id));
  }

  function onDragStart(e: DragStartEvent) {
    dragging.current = true;
    setActive(cardById.get(String(e.active.id)) ?? null);
  }

  function onDragOver(e: DragOverEvent) {
    // Solo señalamos la columna destino (highlight). Nada de mutar listas aquí.
    const over = e.over ? findColumn(String(e.over.id)) : null;
    setTargetCol(over ?? null);
  }

  function finishDrag() {
    setActive(null);
    setTargetCol(null);
    dragging.current = false;
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 120);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active: a, over } = e;
    finishDrag();
    if (!over) return;

    const cardId = String(a.id);
    const fromCol = findColumn(cardId);
    const toCol = findColumn(String(over.id));
    if (!fromCol || !toCol) return;

    const snapshot = items; // para rollback
    let next: ItemsMap;
    let orderedIds: string[];
    let fromOrderedIds: string[] | undefined;

    if (fromCol === toCol) {
      const list = items[fromCol];
      const oldIndex = list.findIndex((c) => c.id === cardId);
      const overIndex = list.findIndex((c) => c.id === String(over.id));
      if (oldIndex < 0 || overIndex < 0 || oldIndex === overIndex) return;
      const newList = arrayMove(list, oldIndex, overIndex);
      next = { ...items, [fromCol]: newList };
      orderedIds = newList.map((c) => c.id);
    } else {
      const moving = items[fromCol].find((c) => c.id === cardId);
      if (!moving) return;
      const fromList = items[fromCol].filter((c) => c.id !== cardId);
      const toList = [...items[toCol]];
      const overIndex = toList.findIndex((c) => c.id === String(over.id));
      const insertAt = overIndex >= 0 ? overIndex : toList.length;
      toList.splice(insertAt, 0, { ...moving, columnId: toCol });
      next = { ...items, [fromCol]: fromList, [toCol]: toList };
      orderedIds = toList.map((c) => c.id);
      fromOrderedIds = fromList.map((c) => c.id);
    }

    setItems(next);
    startTransition(async () => {
      try {
        await moveCardAction({ cardId, toColumnId: toCol, orderedIds, fromOrderedIds });
      } catch (err) {
        if (process.env.NODE_ENV === "development") console.error("[board] moveCardAction falló:", err);
        setItems(snapshot); // rollback visual
        toast.show({
          tone: "warn",
          message: "No se pudo guardar el movimiento. La tarjeta volvió a su lugar.",
        });
      }
    });
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={finishDrag}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-2 md:px-2" data-testid="board">
          {columns.map((col) => (
            <Column
              key={col.id}
              column={col}
              cards={items[col.id] ?? []}
              highlight={targetCol === col.id}
              activeId={active?.id ?? null}
              nextActionCardId={nextActionCardId}
              onOpen={(c) => {
                if (!justDragged.current) openTaskUrl(c.id);
              }}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {active && (
            <div className="w-64 rotate-2">
              <CardFace card={active} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
}

function Column({
  column,
  cards,
  highlight,
  activeId,
  onOpen,
  nextActionCardId,
}: {
  column: BoardColumn;
  cards: BoardCard[];
  highlight: boolean;
  activeId: string | null;
  onOpen: (c: BoardCard) => void;
  nextActionCardId: string | null;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });
  const [adding, setAdding] = useState(false);
  const accent = KIND_ACCENT[column.kind] ?? "border-t-sand-deep";

  return (
    <section
      aria-label={`Lista ${column.title}`}
      className={`w-[276px] shrink-0 rounded-2xl bg-beige/70 border border-sand border-t-[3px] ${accent} flex flex-col max-h-[70vh] transition-shadow ${
        highlight ? "ring-2 ring-sage-deep/60" : ""
      }`}
      data-testid={`column-${column.kind}`}
    >
      <header className="flex items-center justify-between px-3 pt-3 pb-1.5">
        <h3 className="text-[13px] font-semibold text-ink-green font-body">{column.title}</h3>
        <span className="text-xs text-stone-soft tabular-nums">{cards.length}</span>
      </header>
      <div ref={setNodeRef} className="flex-1 overflow-y-auto px-2 pb-1 flex flex-col gap-2 min-h-[48px]">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} dimmed={card.id === activeId} onOpen={onOpen} isNext={card.id === nextActionCardId} />
          ))}
        </SortableContext>
      </div>
      <footer className="p-2">
        {adding ? (
          <form
            action={async (fd) => {
              await createCardInColumnAction(fd);
              setAdding(false);
            }}
            className="flex flex-col gap-1.5"
          >
            <input type="hidden" name="columnId" value={column.id} />
            <input
              name="title"
              className="input !min-h-9 text-sm"
              placeholder="Título de la tarjeta"
              autoFocus
              required
              onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
              data-testid={`quickadd-input-${column.kind}`}
            />
            <div className="flex gap-1.5">
              <button type="submit" className="btn btn-primary !py-1 !min-h-8 text-xs flex-1">Añadir</button>
              <button type="button" className="btn btn-ghost !py-1 !min-h-8 text-xs" onClick={() => setAdding(false)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-stone hover:bg-sand/60 transition-colors"
            data-testid={`quickadd-${column.kind}`}
          >
            <Plus size={14} aria-hidden /> Añadir tarjeta
          </button>
        )}
      </footer>
    </section>
  );
}

function SortableCard({
  card,
  dimmed,
  onOpen,
  isNext,
}: {
  card: BoardCard;
  dimmed: boolean;
  onOpen: (c: BoardCard) => void;
  isNext: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={isDragging || dimmed ? "opacity-40" : ""}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(card)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
            e.preventDefault();
            onOpen(card);
          }
        }}
        className="w-full text-left"
        data-testid={`card-${card.id}`}
        aria-label={`Abrir tarjeta «${card.title}»`}
      >
        <CardFace card={card} isNext={isNext} />
      </div>
    </div>
  );
}

const TYPE_EMOJI: Record<string, string> = {
  idea: "💡",
  pregunta: "❓",
  decision: "⚖️",
  recurso: "🔗",
  aprendizaje: "🌱",
  seguimiento: "🤝",
};

function CardFace({ card, isNext = false }: { card: BoardCard; isNext?: boolean }) {
  const checklist = card.checklist ?? [];
  const doneCount = checklist.filter((i) => i.done).length;
  return (
    <div className="card !rounded-xl p-3 hover:shadow-lift transition-shadow cursor-grab active:cursor-grabbing relative">
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-sm leading-snug min-w-0">
          {TYPE_EMOJI[card.type] && <span className="mr-1" aria-hidden>{TYPE_EMOJI[card.type]}</span>}
          {card.title}
        </p>
        <CardMenu cardId={card.id} title={card.title} completed={Boolean(card.completedAt)} />
      </div>
      {(isNext || card.duration || card.dueDate || card.blockedReason || card.waitingFor || checklist.length > 0 || card.priority === "alta") && (
        <div className="flex flex-wrap gap-1 mt-2">
          {isNext && <span className="chip chip-sage" data-testid="board-next-chip">→ Siguiente acción</span>}
          {card.priority === "alta" && <span className="chip chip-sage">Alta</span>}
          {durationShort(card.duration) && (
            <span className="chip"><Clock size={10} aria-hidden />{durationShort(card.duration)}</span>
          )}
          {card.dueDate && (
            <span className="chip"><CalendarClock size={10} aria-hidden />{card.dueDate.slice(5)}</span>
          )}
          {card.blockedReason && (
            <span className="chip chip-blocked"><Ban size={10} aria-hidden />Bloqueada</span>
          )}
          {card.waitingFor && (
            <span className="chip chip-waiting"><Hourglass size={10} aria-hidden />Esperando</span>
          )}
          {checklist.length > 0 && (
            <span className="chip"><ListChecks size={10} aria-hidden />{doneCount}/{checklist.length}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Menú de tres puntos de la tarjeta: completar/reabrir y eliminar con confirmación.
 *  Detiene la propagación del clic para no abrir el detalle ni disparar el
 *  drag-and-drop del tablero (dnd-kit solo activa el arrastre tras moverse
 *  8px, así que un clic simple aquí siempre llega como clic). */
function CardMenu({ cardId, title, completed }: { cardId: string; title: string; completed: boolean }) {
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function toggleComplete() {
    start(async () => {
      let freedAt: number | null = null;
      try {
        const res = await completeCardAction(cardId, !completed);
        freedAt = res.freedPriorityAt;
      } catch {
        toast.show({ tone: "error", message: "No se pudo guardar el cambio. La tarea quedó como estaba." });
        return;
      }
      setMenu(false);
      if (!completed) {
        toast.show({
          message: "Tarea completada ✓",
          action: {
            label: "Deshacer",
            onClick: async () => {
              try {
                await completeCardAction(cardId, false, freedAt);
              } catch {
                toast.show({ tone: "error", message: "No se pudo deshacer. Puedes reabrirla desde Terminadas." });
              }
            },
          },
          link: { label: "Ver en terminadas", href: "/tareas?v=terminadas" },
          duration: 8000,
        });
      } else {
        toast.show({ tone: "info", message: "Tarea reabierta — volvió a Próximo." });
      }
    });
  }

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`Menú de «${title}»`}
        className="btn btn-ghost !p-1 -mt-0.5 -mr-0.5"
        onClick={() => {
          setMenu((m) => !m);
          setConfirmDelete(false);
        }}
        data-testid={`card-menu-${cardId}`}
      >
        <MoreHorizontal size={14} aria-hidden />
      </button>
      {menu && (
        <div className="absolute right-0 z-20 mt-1 card p-1.5 flex flex-col min-w-40 text-sm">
          <button
            type="button"
            disabled={pending}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-sand"
            data-testid={`card-menu-complete-${cardId}`}
            onClick={toggleComplete}
          >
            <CheckCircle2 size={14} aria-hidden /> {completed ? "Marcar como pendiente" : "Marcar como completada"}
          </button>
          <div className="my-1 border-t border-beige" />
          {confirmDelete ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5">
              <span className="text-xs text-stone">¿Eliminar?</span>
              <button
                type="button"
                disabled={pending}
                className="btn btn-danger !py-1 !px-2 text-xs"
                data-testid={`card-menu-delete-confirm-${cardId}`}
                onClick={() =>
                  start(async () => {
                    await deleteCardAction(cardId);
                    setMenu(false);
                    toast.show({ tone: "info", message: "Tarea eliminada." });
                  })
                }
              >
                Sí, eliminar
              </button>
              <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setConfirmDelete(false)}>
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-blocked hover:bg-blocked-soft"
              data-testid={`card-menu-delete-${cardId}`}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} aria-hidden /> Eliminar tarea
            </button>
          )}
        </div>
      )}
    </div>
  );
}
