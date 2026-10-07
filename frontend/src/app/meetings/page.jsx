import { Suspense } from "react";
import MeetingsPage from "@/components/dashboard/MeetingsPage";

export default function Page() {
  return (
    <Suspense fallback={<p className="page-loading">Loading meetings…</p>}>
      <MeetingsPage />
    </Suspense>
  );
}
