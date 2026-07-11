import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { exportAllJson } from "@/lib/export/exporters";

export async function GET() {
  if (!(await isAuthenticated())) return new NextResponse("No autorizada", { status: 401 });
  const data = await exportAllJson();
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="mafer-os-${data.exportedAt.slice(0, 10)}.json"`,
    },
  });
}
