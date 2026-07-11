"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Download, HardDriveDownload, BookOpen, Trash2, Wand2 } from "lucide-react";
import {
  createBackupAction,
  syncObsidianAction,
  convertDemoToRealAction,
  deleteDemoDataAction,
  type DemoCounts,
} from "@/lib/actions/maintenance";
import { useToast } from "@/components/ui/toast";

export function BackupButtons({
  lastBackup,
  lastSync,
}: {
  lastBackup: string | null;
  lastSync: string | null;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <a href="/api/export/json" className="btn btn-secondary" download>
          <Download size={15} aria-hidden /> Descargar JSON
        </a>
        <a href="/api/export/markdown" className="btn btn-secondary" download>
          <Download size={15} aria-hidden /> Descargar Markdown
        </a>
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          data-testid="create-backup"
          onClick={() =>
            start(async () => {
              const r = await createBackupAction();
              toast.show(
                r.ok
                  ? { message: "Respaldo completo creado ✓", link: { label: "¿Cómo restaurar?", href: "/ajustes" } }
                  : { tone: "warn", message: r.error ?? "No se pudo crear el respaldo." }
              );
            })
          }
        >
          <HardDriveDownload size={15} aria-hidden /> {pending ? "Creando…" : "Crear respaldo completo"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending}
          data-testid="sync-obsidian"
          onClick={() =>
            start(async () => {
              const r = await syncObsidianAction();
              toast.show(
                r.ok
                  ? { message: `Vault de Obsidian actualizado ✓ (${r.notes} notas)` }
                  : { tone: "warn", message: r.error ?? "No se pudo actualizar el vault." }
              );
            })
          }
        >
          <BookOpen size={15} aria-hidden /> Actualizar Obsidian
        </button>
      </div>
      <div className="text-xs text-stone flex flex-col gap-0.5">
        <p>Último respaldo completo: {lastBackup ? lastBackup.slice(0, 16).replace("T", " a las ") : "aún no has creado uno desde la app"}</p>
        <p>Última actualización de Obsidian: {lastSync ? lastSync.slice(0, 16).replace("T", " a las ") : "aún no (también puedes usar npm run sync:obsidian)"}</p>
      </div>
    </div>
  );
}

export function DemoDataControls({ counts }: { counts: DemoCounts }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  if (counts.total === 0) {
    return <p className="text-sm text-stone">Ya no quedan datos de ejemplo. Todo lo que ves es tuyo. 🌿</p>;
  }

  const detalle = [
    counts.projects && `${counts.projects} proyectos`,
    counts.cards && `${counts.cards} tarjetas`,
    counts.inbox && `${counts.inbox} capturas`,
    counts.learning && `${counts.learning} temas Learn Fast`,
    counts.ideas && `${counts.ideas} ideas`,
    counts.prompts && `${counts.prompts} prompts`,
    counts.resources && `${counts.resources} recursos`,
    counts.events && `${counts.events} eventos`,
  ].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-stone">
        Quedan <strong className="text-charcoal">{counts.total} elementos de ejemplo</strong> (los que llevan la
        etiqueta «Ejemplo»): {detalle}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/proyectos?f=todos" className="btn btn-secondary text-sm">Ver datos de ejemplo</Link>
        <button
          type="button"
          className="btn btn-secondary text-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await convertDemoToRealAction();
              toast.show({ message: "Listo: los ejemplos ahora son datos tuyos (sin etiqueta)." });
            })
          }
        >
          <Wand2 size={14} aria-hidden /> Convertir en datos reales
        </button>
        {confirming ? (
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-stone">
              Se eliminarán <strong className="text-blocked">{counts.total} elementos de ejemplo</strong>. Tus datos
              reales, tu configuración y tus agentes no se tocan. ¿Segura?
            </span>
            <button
              type="button"
              className="btn btn-danger text-sm"
              disabled={pending}
              data-testid="confirm-delete-demo"
              onClick={() =>
                start(async () => {
                  await deleteDemoDataAction();
                  setConfirming(false);
                  toast.show({ message: `${counts.total} elementos de ejemplo eliminados.` });
                })
              }
            >
              Sí, eliminar ejemplos
            </button>
            <button type="button" className="btn btn-ghost text-sm" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </span>
        ) : (
          <button type="button" className="btn btn-danger text-sm" onClick={() => setConfirming(true)} data-testid="delete-demo">
            <Trash2 size={14} aria-hidden /> Eliminar todos los ejemplos
          </button>
        )}
      </div>
    </div>
  );
}
