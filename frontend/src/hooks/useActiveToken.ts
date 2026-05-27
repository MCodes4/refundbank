"use client";

import { useEffect, useState } from "react";
import { supabase, type ActiveToken } from "@/lib/supabase";

interface UseActiveTokenReturn {
  token:     ActiveToken | null;
  loading:   boolean;
  newLaunch: ActiveToken | null; // set for 60s when a new token is detected
  clearNewLaunch: () => void;
}

export function useActiveToken(): UseActiveTokenReturn {
  const [token,      setToken]      = useState<ActiveToken | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [newLaunch,  setNewLaunch]  = useState<ActiveToken | null>(null);
  const [prevMint,   setPrevMint]   = useState<string | null>(null);

  useEffect(() => {
    // Initial load
    supabase
      .from("active_token")
      .select("*")
      .eq("is_active", true)
      .single()
      .then(({ data }) => {
        setToken(data ?? null);
        setPrevMint(data?.mint_address ?? null);
        setLoading(false);
      });

    // Realtime subscription — fires when active_token table changes
    const channel = supabase
      .channel("active-token-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "active_token" },
        (payload) => {
          const row = payload.new as ActiveToken;
          if (!row.is_active) return;

          setToken(row);

          // Only show banner if this is actually a different token
          if (prevMint && row.mint_address !== prevMint) {
            setNewLaunch(row);
            setTimeout(() => setNewLaunch(null), 60_000);
          }

          setPrevMint(row.mint_address);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return {
    token,
    loading,
    newLaunch,
    clearNewLaunch: () => setNewLaunch(null),
  };
}
