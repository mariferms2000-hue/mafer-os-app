import Link from "next/link";
import { ArrowLeft, ListTodo } from "lucide-react";
import { getTasksWithoutProject } from "@/lib/queries/projects";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TaskLine } from "@/components/hoy/task-line";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tareas sin proyecto" };

/* Vista inteligente dentro de Proyectos: reúne las tareas sueltas (sin proyecto
   asignado) para encontrarlas y ordenarlas sin restaurar la pestaña «Tareas».
   Reutiliza TaskLine (abrir, completar/reabrir y eliminar por el menú de tres
   puntos) y el modal global de detalle montado en el layout — que al abrir una
   tarea permite además asignarla a un proyecto existente. No duplica lógica de
   tareas ni depende de datos nuevos. */
export default async function ProyectosSinProyectoPage() {
  const cards = await getTasksWithoutProject();

  return (
    <div>
      <PageHeader
        icon={ListTodo}
        title="Tareas sin proyecto"
        intro="Tareas sueltas que aún no pertenecen a ningún proyecto. Ábrelas para trabajarlas, completarlas o asignarlas a un proyecto."
      >
        <Link href="/proyectos" className="btn btn-ghost" data-testid="sin-proyecto-back">
          <ArrowLeft size={15} aria-hidden /> Volver a Proyectos
        </Link>
      </PageHeader>

      {cards.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Todo asignado 🌿"
          hint="No tienes tareas sueltas: cada tarea abierta ya pertenece a un proyecto."
        />
      ) : (
        <div className="card p-5" data-testid="sin-proyecto-list">
          <ul className="divide-y divide-beige">
            {cards.map((c) => (
              <li key={c.id}>
                <TaskLine card={c} showProject={false} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
