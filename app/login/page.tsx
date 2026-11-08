"use client";

import { useActionState } from "react";
import { login } from "./actions";

const inputStyle = {
  padding: "8px 10px",
  borderRadius: "var(--r-chip)",
  border: "1px solid var(--line)",
  background: "var(--surface)",
  color: "var(--text)",
  font: "inherit",
} as const;

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, null);
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <form
        action={formAction}
        className="glass"
        style={{
          width: "100%",
          maxWidth: 340,
          padding: 24,
          borderRadius: "var(--r-panel)",
          display: "grid",
          gap: 14,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20 }}>Sign in</h1>
        <label style={{ display: "grid", gap: 4, color: "var(--muted)" }}>
          Username
          <input name="username" autoComplete="username" required autoFocus style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 4, color: "var(--muted)" }}>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            style={inputStyle}
          />
        </label>
        {error && (
          <p role="alert" style={{ margin: 0, color: "var(--rank-e)" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "9px 12px",
            borderRadius: "var(--r-chip)",
            border: "1px solid var(--line)",
            background: "var(--accent)",
            color: "#0F1631",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
