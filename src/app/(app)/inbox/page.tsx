import { asc, desc, eq } from "drizzle-orm";
import { Inbox as InboxIcon, Sparkles } from "lucide-react";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { InboxList } from "@/components/inbox/inbox-list";
import { LifecycleHelp } from "@/components/inbox/lifecycle-help";

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
    <div className="max-w-3xl">
      <PageHeader
        icon={InboxIcon}
        title="Inbox"
        intro="Captura sin decidir. Cuando tengas un momento, toca «Procesar» y dale un destino a cada cosa."
      />

      {pending.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Inbox en cero 🌿"
          hint="Cuando algo te pase por la cabeza, usa el botón + (está en todas las pantallas). Se guarda aquí al instante."
        />
      ) : (
        <InboxList items={pending} projects={projects} />
      )}

      <LifecycleHelp />

      {processed.length > 0 && (
        <details className="mt-6">
          <summary className="text-sm text-stone cursor-pointer">
            Procesadas recientemente ({processed.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {processed.map((i) => (
              <li key={i.id} className="text-sm text-stone-soft flex items-center gap-2 py-1">
                <span className="line-through truncate">{i.content}</span>
                {i.convertedTo && (
                  <span className="chip shrink-0">
                    {i.convertedTo === "archivado" ? "archivada" : `→ ${i.convertedTo.split(":")[0]}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
