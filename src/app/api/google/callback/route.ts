import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { handleGoogleCallback } from "@/lib/google/calendar";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/calendario?google=error", req.url));
  }
  try {
    await handleGoogleCallback(code);
    return NextResponse.redirect(new URL("/calendario?google=conectado", req.url));
  } catch (e) {
    console.error("[google-callback]", e);
    return NextResponse.redirect(new URL("/calendario?google=error", req.url));
  }
}
