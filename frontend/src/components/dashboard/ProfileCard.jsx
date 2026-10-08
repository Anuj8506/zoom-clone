import Link from "next/link";
import { UserRound } from "lucide-react";

export default function ProfileCard({ profile }) {
  return (
    <section className="portal-card profile-card" aria-label="Your profile">
      <div className="profile-placeholder">
        <UserRound size={64} strokeWidth={1.5} />
      </div>
      <div className="profile-copy">
        <h1>{profile?.display_name || "Demo User"}</h1>
        <p>
          Plan: <span>Workplace Basic</span>
        </p>
      </div>
      <Link className="profile-settings" href="/settings">
        Profile settings
      </Link>
    </section>
  );
}
