import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, now, schema } from "./db";

const COOKIE = "mafer_session";
const SESSION_DAYS = 90;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta AUTH_SECRET en .env.local — corre `npm run setup`.");
  return new TextEncoder().encode(s);
}

async function getSetting(key: string): Promise<string | null> {
  const row = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await db
    .insert(schema.settings)
    .values({ key, value, updatedAt: now() })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: now() } });
}

export async function hasPassword(): Promise<boolean> {
  return (await getSetting("password_hash")) !== null;
}

export async function createPassword(password: string, name: string) {
  if (await hasPassword()) throw new Error("Ya existe una contraseña.");
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  await setSetting("password_hash", await bcrypt.hash(password, 12));
  await setSetting("user_name", name || "Mafer");
}

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = await getSetting("password_hash");
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export async function createSession() {
  const token = await new SignJWT({ u: "mafer" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.LOCAL_HTTP !== "1",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export async function requireAuth() {
  if (!(await isAuthenticated())) throw new Error("No autenticada.");
}

export async function getUserName(): Promise<string> {
  return (await getSetting("user_name")) ?? "Mafer";
}

export { getSetting };
