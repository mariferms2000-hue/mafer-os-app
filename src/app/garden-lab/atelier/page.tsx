import { notFound } from "next/navigation";
import { AtelierLab } from "./atelier";

export const metadata = { title: "Laboratorio del jardín · Invernadero" };

/* /garden-lab/atelier — laboratorio visual de A2 (Luz de invernadero) en
   escritorio y tres propuestas de iPhone. Fuera de (app), sin base y nunca en
   producción. */
export default function AtelierLabPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <AtelierLab />;
}
