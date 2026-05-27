"use client";

import { type ActiveToken } from "@/lib/supabase";

interface Props {
  token:   ActiveToken;
  onDismiss: () => void;
}

export default function NewLaunchBanner({ token, onDismiss }: Props) {
  const ticker = token.symbol ? `$${token.symbol}` : token.mint_address.slice(0, 8) + "…";

  return (
    <div
      className="fixed top-14 left-0 right-0 z-40 flex items-center justify-between gap-4 px-5 sm:px-8 py-2.5"
      style={{
        background:   "rgba(0, 214, 122, 0.10)",
        borderBottom: "1px solid rgba(0, 214, 122, 0.2)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-center gap-3">
        <span className="live-dot" style={{ background: "var(--green)" }} />
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize:   "12px",
            color:      "var(--green)",
          }}
        >
          New launch detected: {ticker} — vault reset
        </span>
        {token.pump_fun_url && (
          <a
            href={token.pump_fun_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily:  "JetBrains Mono, monospace",
              fontSize:    "10px",
              color:       "rgba(0,214,122,0.6)",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--green)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,214,122,0.6)")}
          >
            pump.fun ↗
          </a>
        )}
      </div>
      <button
        onClick={onDismiss}
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize:   "10px",
          color:      "rgba(0,214,122,0.5)",
          background: "transparent",
          border:     "none",
          cursor:     "pointer",
          padding:    "2px 4px",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--green)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,214,122,0.5)")}
      >
        ✕
      </button>
    </div>
  );
}
