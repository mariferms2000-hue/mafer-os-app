import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getGoogleAuthUrl, isGoogleConfigured } from "@/lib/google/calendar";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/calendario?google=sin-configurar", req.url));
  }
  return NextResponse.redirect(getGoogleAuthUrl());
}
