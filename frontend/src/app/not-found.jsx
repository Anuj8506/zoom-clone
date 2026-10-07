import Link from "next/link";

export default function NotFound() {
  return (
    <main className="standalone">
      <span className="wordmark">
        zoom<span>clone</span>
      </span>
      <h1>Page not found</h1>
      <p>Let’s get you back to your meetings.</p>
      <Link className="button primary" href="/">
        Back to Home
      </Link>
    </main>
  );
}
