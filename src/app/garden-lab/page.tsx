import { notFound } from "next/navigation";
import { GardenLab } from "./garden-lab";
import type { Direction } from "./lab-data";

export const metadata = { title: "Laboratorio del jardín" };

/* /garden-lab — laboratorio visual de F4 (Bloque 1). Vive fuera de (app): no
   carga la navegación ni consulta la base. Sigue detrás del inicio de sesión
   (proxy) y nunca existe en producción. */
export default async function GardenLabPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  if (process.env.VERCEL_ENV === "production") notFound();
  const { d } = await searchParams;
  const initialDir: Direction = d === "B" || d === "C" || d === "D" ? d : "A";
  return <GardenLab initialDir={initialDir} />;
}
