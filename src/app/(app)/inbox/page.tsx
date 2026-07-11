import { asc, desc, eq } from "drizzle-orm";
import { Inbox as InboxIcon, Sparkles } from "lucide-react";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { InboxItem } from "@/components/inbox/inbox-item";
import { LifecycleDiagram } from "@/components/diagrams/lifecycle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const pending = await db
    .select()
    .from(schema.inboxItems)
    .where(eq(schema.inboxItems.processed, false))
    .orderBy(desc(schema.inboxItems.createdAt));
  const processed = await db
    .select()
    .from(schema.inboxItems)
    .where(eq(schema.inboxItems.processed, true))
    .orderBy(desc(schema.inboxItems.createdAt))
    .limit(15);
  const projects = await db
    .select({ id: schema.projects.id, title: schema.projects.title })
    .from(schema.projects)
    .where(eq(schema.projects.archived, false))
    .orderBy(asc(schema.projects.title));

  return (
    <div>
      <PageHeader
        icon={InboxIcon}
        title="Inbox"
        intro="Todo lo que capturas cae aquí. No decidas nada al capturar; decide después, con calma, qué es cada cosa."
      />

      {pending.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Inbox en cero 🌿"
          hint="Cuando algo te pase por la cabeza, usa el botón + (está en todas las pantallas). Se guarda aquí al instante."
        />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="inbox-list">
          {pending.map((item) => (
            <InboxItem key={item.id} item={item} projects={projects} />
          ))}
        </ul>
      )}

      <section className="mt-10">
        <h2 className="text-lg text-forest-deep mb-2">El viaje de una captura</h2>
        <LifecycleDiagram />
      </section>

      {processed.length > 0 && (
        <details className="mt-8">
          <summary className="text-sm text-stone cursor-pointer">
            Procesadas recientemente ({processed.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {processed.map((i) => (
              <li key={i.id} className="text-sm text-stone-soft flex items-center gap-2 py-1">
                <span className="line-through truncate">{i.content}</span>
                {i.convertedTo && <span className="chip shrink-0">→ {i.convertedTo.split(":")[0]}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
