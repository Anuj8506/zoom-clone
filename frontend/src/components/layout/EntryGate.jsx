"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { accountToken, guestMode, signOut } from "@/services/auth";

// This selects the welcome flow; the backend still enforces all account/admin permissions.
export default function EntryGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const guarded = ["/", "/meetings", "/settings", "/admin"].includes(pathname);
  const [access, setAccess] = useState(null);
  useEffect(() => {
    if (!guarded) return;
    const token = accountToken();
    let signedIn = false;
    if (token) {
      try {
        const payload = JSON.parse(
          atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        );
        signedIn = payload.exp * 1000 > Date.now();
        if (!signedIn) signOut();
      } catch {
        signOut();
      }
    }
    const allowed = signedIn || guestMode();
    setAccess({ pathname, allowed });
    if (!allowed) router.replace("/signin");
  }, [pathname, guarded, router]);
  if (guarded && (access?.pathname !== pathname || !access.allowed)) {
    return (
      <p className="page-loading" role="status">
        Opening Zoom Clone…
      </p>
    );
  }
  return children;
}
