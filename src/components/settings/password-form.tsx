"use client";

import { useActionState } from "react";
import { changePasswordAction, type PwdState } from "@/lib/actions/settings";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<PwdState, FormData>(changePasswordAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="pw-current">Contraseña actual</label>
        <input id="pw-current" name="current" type="password" className="input" autoComplete="current-password" required />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="pw-next">Nueva contraseña</label>
          <input id="pw-next" name="next" type="password" className="input" autoComplete="new-password" minLength={8} required />
        </div>
        <div>
          <label className="label" htmlFor="pw-confirm">Confírmala</label>
          <input id="pw-confirm" name="confirm" type="password" className="input" autoComplete="new-password" required />
        </div>
      </div>
      {state.error && <p role="alert" className="text-sm text-blocked bg-blocked-soft rounded-lg px-3 py-2">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-done bg-done-soft rounded-lg px-3 py-2">Contraseña actualizada ✓</p>}
      <button type="submit" className="btn btn-secondary self-start" disabled={pending}>
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
