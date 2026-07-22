import { Suspense } from "react";
import { Sidebar, BottomNav } from "@/components/shell/nav";
import { CaptureFab } from "@/components/shell/capture";
import { GlobalShortcuts } from "@/components/shell/shortcuts";
import { PwaSetup } from "@/components/shell/sw-register";
import { TaskDetailFromUrl } from "@/components/tasks/task-detail";
import { EventDetailFromUrl } from "@/components/calendar/event-detail";
import { FocusOverlayFromUrl } from "@/components/focus/focus-overlay";
import { ToastProvider } from "@/components/ui/toast";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const projects = await db
    .select({ id: schema.projects.id, title: schema.projects.title })
    .from(schema.projects)
    .where(eq(schema.projects.archived, false));

  return (
    <ToastProvider>
      <div className="min-h-dvh md:flex">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <main className="flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
        <CaptureFab projects={projects} />
        <BottomNav />
        <GlobalShortcuts />
        <Suspense fallback={null}>
          <TaskDetailFromUrl />
        </Suspense>
        <Suspense fallback={null}>
          <EventDetailFromUrl />
        </Suspense>
        <Suspense fallback={null}>
          <FocusOverlayFromUrl />
        </Suspense>
        <PwaSetup />
      </div>
    </ToastProvider>
  );
}
