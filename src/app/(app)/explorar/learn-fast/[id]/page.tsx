import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db, schema } from "@/lib/db";
import { touchRecent } from "@/lib/db/helpers";
import { ExplorarTabs } from "@/components/explore/tabs";
import { EVIDENCE } from "@/components/explore/evidence";
import { LearningWorkspace } from "@/components/explore/learning-workspace";

export const dynamic = "force-dynamic";

export default async function LearnFastDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [topic] = await db.select().from(schema.learningTopics).where(eq(schema.learningTopics.id, id)).limit(1);
  if (!topic) notFound();

  const topicResources = await db
    .select()
    .from(schema.resources)
    .where(eq(schema.resources.learningId, id))
    .orderBy(asc(schema.resources.createdAt));

  await touchRecent("aprendizaje", id, topic.title, `/explorar/learn-fast/${id}`);
  const evidence = EVIDENCE[topic.evidenceClass ?? ""];

  return (
    <div>
      <Link href="/explorar/learn-fast" className="text-sm text-stone hover:text-charcoal inline-flex items-center gap-1 mb-3">
        <ArrowLeft size={14} aria-hidden /> Learn Fast
      </Link>
      <ExplorarTabs />
      {evidence && (
        <p className="card p-3 mb-4 text-sm text-stone flex items-center gap-2">
          <evidence.icon size={16} className="text-olive shrink-0" aria-hidden />
          <span>
            <strong className="text-charcoal">{evidence.label}:</strong> {evidence.hint}
          </span>
        </p>
      )}
      <LearningWorkspace topic={topic} resources={topicResources} />
    </div>
  );
}
