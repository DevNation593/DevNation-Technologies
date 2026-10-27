"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

export default function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, { error: initialError });

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <label className="field">
        Correo electrónico
        <input name="email" type="email" autoComplete="username" required autoFocus />
      </label>
      <label className="field">
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error && (
        <p className="error-text" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: 6 }} disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
