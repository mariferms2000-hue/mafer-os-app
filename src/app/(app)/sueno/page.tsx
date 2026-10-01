import { Moon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SleepCalculator } from "@/components/sleep/sleep-calculator";

export const metadata = { title: "Sueño" };

/* Sueño — calculadora de ciclos. Herramienta orientativa: toda la lógica vive
   en `@/lib/sleep-logic` (pura y probada); esta página solo la presenta. */
export default function SuenoPage() {
  return (
    <div className="max-w-xl">
      <PageHeader
        icon={Moon}
        title="Sueño"
        intro="Elige a qué hora quieres despertar y te sugiero cuándo acostarte, contando ciclos de sueño."
      />
      <SleepCalculator />
    </div>
  );
}
