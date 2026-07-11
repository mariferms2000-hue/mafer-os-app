import { hasPassword, isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAuthenticated()) redirect("/");
  const firstTime = !(await hasPassword());

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <LeafMark className="mx-auto mb-4 h-14 w-14" />
          <h1 className="text-3xl text-forest-deep">Mafer OS</h1>
          <p className="text-stone mt-2 text-sm">
            {firstTime
              ? "Bienvenida. Crea tu contraseña para empezar."
              : "Tu espacio personal. Escribe tu contraseña."}
          </p>
        </div>
        <LoginForm firstTime={firstTime} />
      </div>
    </main>
  );
}

function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#dde5d6" />
      <path
        d="M32 50c0-14 4-24 16-30-1 14-5 25-16 30Z"
        fill="#45573f"
      />
      <path
        d="M32 50c0-14-4-24-16-30 1 14 5 25 16 30Z"
        fill="#7c9473"
      />
      <path d="M32 50V22" stroke="#324230" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
