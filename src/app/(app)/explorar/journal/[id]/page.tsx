import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db, schema } from "@/lib/db";
import { touchRecent } from "@/lib/db/helpers";
import { JournalEditor } from "@/components/explore/journal-editor";

export const dynamic = "force-dynamic";

export default async function JournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, id)).get();
  if (!entry) notFound();
  await touchRecent("journal", id, entry.title, `/explorar/journal/${id}`);

  return (
    <div className="max-w-3xl">
      <Link href="/explorar/journal" className="text-sm text-stone hover:text-charcoal inline-flex items-center gap-1 mb-4">
        <ArrowLeft size={14} aria-hidden /> Journal
      </Link>
      <JournalEditor entry={entry} />
    </div>
  );
}
