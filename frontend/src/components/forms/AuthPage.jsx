"use client";
import { useEffect, useState } from "react";
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
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    // Read the fields at submit time, including password-manager/autofill values.
    const fields = new FormData(event.currentTarget);
    const enteredEmail = String(fields.get("email") || "").trim();
    const enteredPassword = String(fields.get("password") || "");
    const enteredName = String(fields.get("display_name") || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enteredEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (enteredPassword.length < 8) {
      setError("Enter a password with at least 8 characters.");
      return;
    }
    if (signup && !enteredName) {
      setError("Enter your full name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await (signup
        ? api.signup({
            display_name: enteredName,
            email: enteredEmail,
            password: enteredPassword,
          })
        : api.login({ email: enteredEmail, password: enteredPassword }));
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
        <noscript>
          <p role="alert">Enable JavaScript to sign in to Zoom Clone.</p>
        </noscript>
        <form onSubmit={submit} noValidate>
          {signup && (
            <>
              <label htmlFor="account-name">Full name</label>
              <input
                id="account-name"
                name="display_name"
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
            name="email"
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
            name="password"
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
          <button
            className="button primary full-width"
            type="submit"
            disabled={busy || !ready}
          >
            {!ready
              ? "Loading form…"
              : busy
                ? "Please wait…"
                : signup
                  ? "Create account"
                  : "Sign In"}
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
