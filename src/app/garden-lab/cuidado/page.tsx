import { notFound } from "next/navigation";
import { CareLab } from "./care-lab";

export const metadata = { title: "Laboratorio del jardín · Cuidado" };

/* /garden-lab/cuidado — laboratorio visual de los estados de cuidado (F4):
   normal, con sed, recién regada y especial, en 4 especies. Sin base de datos
   y nunca en producción. */
export default function CareLabPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <CareLab />;
}
