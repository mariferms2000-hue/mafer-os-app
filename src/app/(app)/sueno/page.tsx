import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Moon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SleepCalculator } from "@/components/sleep/sleep-calculator";
import { readSleepState, sleepStateQuery } from "@/lib/sleep-logic";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sueño" };

/* Sueño — calculadora de ciclos. Herramienta orientativa: toda la lógica vive
   en `@/lib/sleep-logic` (pura y probada); esta página solo la presenta.
   El estado vive en la URL (?modo=despertar|dormir&h=HH:MM). Una URL ausente,
   incompleta o inválida se redirige aquí, en el servidor, a su forma canónica
   — así nunca se muestra un estado distinto del que dice la barra.
   force-dynamic para que el servidor ya pinte el estado de la URL
   (useSearchParams) en vez de un hueco vacío que se rellena al hidratar. */
export default async function SuenoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const first = (k: string) => {
    const v = raw[k];
    return (Array.isArray(v) ? v[0] : v) ?? null;
  };
  const state = readSleepState({ get: first });
  if (!state.canonical) redirect(`/sueno?${sleepStateQuery(state)}`);

  return (
    <div className="max-w-xl">
      <PageHeader
        icon={Moon}
        title="Sueño"
        intro="Elige una hora y te sugiero cuándo acostarte o despertar, contando ciclos de sueño."
      />
      <Suspense fallback={null}>
        <SleepCalculator />
      </Suspense>
    </div>
  );
}
