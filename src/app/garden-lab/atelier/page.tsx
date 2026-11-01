import { notFound } from "next/navigation";
import { AtelierLab } from "./atelier";
import type { Variant } from "./atelier-data";

export const metadata = { title: "Laboratorio del jardín · Atelier" };

/* /garden-lab/atelier — ronda 2 del laboratorio visual (tres variantes de A).
   Igual que la ronda 1: fuera de (app), sin base y nunca en producción. */
export default async function AtelierLabPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  if (process.env.VERCEL_ENV === "production") notFound();
  const { v } = await searchParams;
  const initialVariant: Variant = v === "1" || v === "3" ? v : "2";
  return <AtelierLab initialVariant={initialVariant} />;
}
