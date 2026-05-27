"use client";

import { useInView } from "@/hooks/useInView";
import { type ActiveToken } from "@/lib/supabase";

interface Props {
  lastRefundAt: string | null;
  token:        ActiveToken | null;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function HeroSection({ lastRefundAt, token }: Props) {
  const { ref, inView } = useInView(0.05);

  return (
    <section
      id="top"
      ref={ref}
      className={`pt-36 pb-24 reveal ${inView ? "visible" : ""}`}
    >
      {/* Tag */}
      <div className="mb-10">
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            color: "var(--text-3)",
            letterSpacing: "0.06em",
          }}
        >
          Solana · pump.fun · automated
          {token?.symbol && (
            <span style={{ color: "var(--gold)", marginLeft: "8px", opacity: 0.7 }}>
              · ${token.symbol}
            </span>
          )}
        </span>
      </div>

      {/* Headline */}
      <h1
        className="text-5xl sm:text-7xl lg:text-8xl font-medium leading-[1.05] mb-9"
        style={{
          fontFamily: "Newsreader, Georgia, serif",
          letterSpacing: "-0.03em",
          maxWidth: "760px",
        }}
      >
        Built for<br />bagholders.
      </h1>

      {/* Body copy */}
      <p
        className="text-base sm:text-lg leading-relaxed mb-10 max-w-xl"
        style={{ color: "var(--text-2)" }}
      >
        RefundBank is a coin that pays you back. Every trade contributes one
        percent to a treasury. Every two minutes the treasury empties — straight
        to the wallets sitting deepest in the red. No claim button. No vote.
        The bank just pays.
      </p>

      {/* CTAs */}
      <div className="flex flex-wrap items-center gap-4 mb-12">
        {token?.pump_fun_url && (
          <a
            href={token.pump_fun_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 text-sm transition-all duration-150"
            style={{
              fontFamily: "Inter, sans-serif",
              color: "var(--green)",
              border: "1px solid rgba(0,214,122,0.3)",
              borderRadius: "4px",
              background: "rgba(0,214,122,0.06)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,214,122,0.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,214,122,0.06)")}
          >
            Buy on pump.fun
          </a>
        )}
        <a
          href="#ledger"
          className="px-5 py-2.5 text-sm transition-all duration-150"
          style={{
            fontFamily: "Inter, sans-serif",
            color: "var(--gold)",
            border: "1px solid rgba(212,175,55,0.4)",
            borderRadius: "4px",
            background: "rgba(212,175,55,0.07)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,175,55,0.13)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(212,175,55,0.07)")}
        >
          Open the ledger
        </a>
        <a
          href="#how"
          className="px-5 py-2.5 text-sm transition-all duration-150"
          style={{
            fontFamily: "Inter, sans-serif",
            color: "var(--text-2)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-2)")}
        >
          How it pays
        </a>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2.5">
        <span className="live-dot" />
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "12px",
            color: "var(--text-2)",
          }}
        >
          Vault active
          {lastRefundAt && (
            <span style={{ color: "var(--text-3)", marginLeft: "8px" }}>
              · last refund {timeAgo(lastRefundAt)}
            </span>
          )}
        </span>
      </div>
    </section>
  );
}
