import Link from "next/link";
import { BellRing, CalendarX2, Hourglass, FolderX, FolderClock, HelpCircle, Inbox } from "lucide-react";
import type { ForgetAlert } from "@/lib/recommend";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<ForgetAlert["kind"], LucideIcon> = {
  "tarea-vencida": CalendarX2,
  "esperando-mucho": Hourglass,
  "proyecto-sin-accion": FolderX,
  "proyecto-inactivo": FolderClock,
  "hoy-sin-estimar": HelpCircle,
  "inbox-olvidado": Inbox,
};

/** Antiolvido: pocas alertas, ordenadas por urgencia, cada una lleva a la
 *  acción con un clic. Si no hay nada, lo dice en una sola línea tranquila. */
export function ForgetAlerts({ alerts }: { alerts: ForgetAlert[] }) {
  return (
    <section aria-labelledby="antiolvido" className="card p-5" data-testid="forget-alerts">
      <h2 id="antiolvido" className="section-eyebrow flex items-center gap-1.5 mb-2">
        <BellRing size={13} className="text-sage-deep" aria-hidden /> Para que nada se caiga
      </h2>
      {alerts.length === 0 ? (
        <p className="text-sm text-stone" data-testid="no-alerts">Nada olvidado por hoy. 🌿</p>
      ) : (
        <ul className="flex flex-col">
          {alerts.map((a, i) => {
            const Icon = ICONS[a.kind];
            return (
              <li key={`${a.kind}-${i}`} className="border-b border-beige last:border-0">
                <Link
                  href={a.href}
                  className="flex items-start gap-2.5 py-2 text-sm hover:text-forest transition-colors"
                  data-testid={`alert-${a.kind}`}
                >
                  <Icon size={15} className="mt-0.5 shrink-0 text-olive" aria-hidden />
                  <span className="min-w-0">{a.text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
