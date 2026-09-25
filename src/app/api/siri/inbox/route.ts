import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { insertInboxItem } from "@/lib/db/helpers";
import { parseInbox, tokenValido } from "@/lib/siri-logic";

/** Atajo de iPhone «Anota en Mafer OS» → Inbox.
 *  POST { "texto": "..." } con Authorization: Bearer <SIRI_TOKEN>.
 *  `mensaje` es lo que Siri lee en voz alta. Solo crea: no lee ni borra nada. */
export async function POST(req: Request) {
  if (!tokenValido(req.headers.get("authorization"), process.env.SIRI_TOKEN)) {
    return NextResponse.json({ ok: false, mensaje: "No autorizado." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const r = parseInbox(body);
  if (!r.ok) return NextResponse.json({ ok: false, mensaje: r.error }, { status: 400 });

  const id = await insertInboxItem({ content: r.datos.content });
  revalidatePath("/inbox");
  revalidatePath("/");
  return NextResponse.json({ ok: true, id, mensaje: "Listo, quedó en tu Inbox." });
}
