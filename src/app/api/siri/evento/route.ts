import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { insertEvent } from "@/lib/db/helpers";
import { syncEventToGoogle } from "@/lib/google/calendar";
import { fraseCuando, parseEvento, tokenValido } from "@/lib/siri-logic";

/** Atajo de iPhone «Evento en Mafer OS» → Calendario (+ Google Calendar).
 *  POST { "titulo", "fecha", "hora"?, "duracion"? } con
 *  Authorization: Bearer <SIRI_TOKEN>. Formato en src/lib/siri-logic.ts. */
export async function POST(req: Request) {
  if (!tokenValido(req.headers.get("authorization"), process.env.SIRI_TOKEN)) {
    return NextResponse.json({ ok: false, mensaje: "Not authorized." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const r = parseEvento(body);
  if (!r.ok) return NextResponse.json({ ok: false, mensaje: r.error }, { status: 400 });

  const id = await insertEvent(r.datos);
  // Igual que el formulario: si Google Calendar está conectado, se sincroniza.
  const gcal = await syncEventToGoogle(id).catch(() => null);
  revalidatePath("/calendario");
  revalidatePath("/");
  return NextResponse.json({
    ok: true,
    id,
    google: Boolean(gcal),
    mensaje: `Done, I scheduled "${r.datos.title}" for ${fraseCuando(r.datos.date, r.datos.startTime)}${gcal ? " and added it to Google Calendar" : ""}.`,
  });
}
