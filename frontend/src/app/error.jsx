"use client";

export default function ErrorPage({ reset }) {
  return (
    <main className="standalone">
      <h1>Something went wrong</h1>
      <p>Please try loading this screen again.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
