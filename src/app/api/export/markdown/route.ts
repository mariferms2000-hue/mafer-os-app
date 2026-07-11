import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { exportAllMarkdown } from "@/lib/export/exporters";

/** Devuelve un único .md concatenado con separadores por archivo (fácil de leer y de partir). */
export async function GET() {
  if (!(await isAuthenticated())) return new NextResponse("No autorizada", { status: 401 });
  const files = await exportAllMarkdown();
  const combined = Object.entries(files)
    .map(([path, content]) => `<!-- archivo: ${path} -->\n\n${content}`)
    .join("\n\n---\n\n");
  return new NextResponse(combined, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="mafer-os-${new Date().toISOString().slice(0, 10)}.md"`,
    },
  });
}
