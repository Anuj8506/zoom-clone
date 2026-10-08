"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/services/auth";
import Alert from "@/components/ui/Alert";

export default function AccountControls({ profile }) {
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <section className="account-controls">
      <h2>Account</h2>
      <p>
        {profile?.id > 1
          ? `Signed in as ${profile.email}`
          : "You are using the demo account. Sign in to keep your own meeting list."}
      </p>
      {profile?.id > 1 ? (
        <button
          className="button"
          onClick={() => {
            try {
              signOut();
              router.replace("/signin");
            } catch {
              setError(
                "Could not clear your session. Check your browser storage settings.",
              );
            }
          }}
        >
          Sign Out
        </button>
      ) : (
        <Link className="button primary" href="/signin">
          Sign In / Sign Up
        </Link>
      )}
      <Alert>{error}</Alert>
    </section>
  );
}
