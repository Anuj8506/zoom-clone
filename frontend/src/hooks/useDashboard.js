"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";

export default function useDashboard() {
  const [data, setData] = useState({
    profile: null,
    health: null,
    upcoming: [],
    recent: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [profile, health, upcoming, recent] = await Promise.all([
        api.profile(),
        api.health(),
        api.upcoming(),
        api.recent(),
      ]);
      setData({ profile, health, upcoming, recent });
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { ...data, loading, error, refresh };
}
