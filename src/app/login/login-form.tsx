"use client";

import { useActionState } from "react";
import { loginAction, type AuthState } from "@/lib/actions/auth";

export function LoginForm({ firstTime }: { firstTime: boolean }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="card p-6 flex flex-col gap-4">
      {firstTime && (
        <div>
          <label className="label" htmlFor="name">Tu nombre</label>
          <input id="name" name="name" className="input" defaultValue="Mafer" autoComplete="name" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete={firstTime ? "new-password" : "current-password"}
          autoFocus
          required
          minLength={firstTime ? 8 : undefined}
        />
      </div>
      {firstTime && (
        <div>
          <label className="label" htmlFor="confirm">Confirma tu contraseña</label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            className="input"
            autoComplete="new-password"
            required
          />
        </div>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-blocked bg-blocked-soft rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Un momento…" : firstTime ? "Crear y entrar" : "Entrar"}
      </button>
      {firstTime && (
        <p className="text-xs text-stone-soft text-center">
          Guárdala en un lugar seguro: es la llave de tu sistema.
        </p>
      )}
    </form>
  );
}
