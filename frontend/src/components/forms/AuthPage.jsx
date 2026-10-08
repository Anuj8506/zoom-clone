"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/services/api";
import { signIn, signOut } from "@/services/auth";
import { savePreferences } from "@/services/storage";
import Alert from "@/components/ui/Alert";

export default function AuthPage() {
  const router = useRouter();
  const [signup, setSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await (signup
        ? api.signup({ display_name: name, email, password })
        : api.login({ email, password }));
      signIn(result.access_token);
      try {
        savePreferences({
          displayName: result.user.display_name,
          audioEnabled: true,
          videoEnabled: false,
        });
      } catch {}
      router.push("/");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <header className="auth-header">
        <Link className="wordmark" href="/">
          zoom
        </Link>
        <button
          className="auth-switch"
          onClick={() => {
            try {
              signOut();
              router.push("/");
            } catch {
              setError("Your browser could not clear the account session.");
            }
          }}
        >
          Continue as demo user
        </button>
      </header>
      <main className="auth-card">
        <h1>{signup ? "Sign Up" : "Sign In"}</h1>
        <p>
          {signup
            ? "Create your Zoom Clone account"
            : "Welcome back to Zoom Clone"}
        </p>
        <form onSubmit={submit}>
          {signup && (
            <>
              <label htmlFor="account-name">Full name</label>
              <input
                id="account-name"
                required
                maxLength={80}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </>
          )}
          <label htmlFor="account-email">Email address</label>
          <input
            id="account-email"
            type="email"
            required
            maxLength={255}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="account-password">Password</label>
          <input
            id="account-password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete={signup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="small muted">Use at least 8 characters.</p>
          <Alert>{error}</Alert>
          <button className="button primary full-width" disabled={busy}>
            {busy ? "Please wait…" : signup ? "Create account" : "Sign In"}
          </button>
        </form>
        <button
          className="auth-switch"
          disabled={busy}
          onClick={() => {
            setSignup(!signup);
            setError("");
            setPassword("");
          }}
        >
          {signup
            ? "Already have an account? Sign In"
            : "New to Zoom Clone? Sign Up"}
        </button>
      </main>
    </div>
  );
}
