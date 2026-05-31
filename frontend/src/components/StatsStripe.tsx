"use client";

import { useCountUp } from "@/hooks/useCountUp";
import { useInView } from "@/hooks/useInView";

interface Props {
  totalClaimedSol:     number;
  totalDistributed:    number;
  refundsIssued:       number;
  lastRefundAt:        string | null;
  loading:             boolean;
}

function Stat({
  label,
  value,
  suffix = "",
  decimals = 2,
  loading,
}: {
  label:    string;
  value:    number;
  suffix?:  string;
  decimals?: number;
  loading:  boolean;
}) {
  const counted = useCountUp(loading ? 0 : value, 1600);
  return (
    <div className="flex flex-col gap-1 py-6 sm:py-0">
      <span
        className="text-xs uppercase tracking-widest"
        style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
      >
        {label}—
      </span>
      {loading ? (
        <span className="skeleton w-20 h-7" />
      ) : (
        <span
          className="text-3xl font-medium"
          style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--text-1)", letterSpacing: "-0.02em" }}
        >
          {decimals === 0 ? Math.floor(counted).toLocaleString() : counted.toFixed(decimals)}
          {suffix && <span style={{ color: "var(--text-2)", fontSize: "0.65em", marginLeft: "4px" }}>{suffix}</span>}
        </span>
      )}
    </div>
  );
}

export default function StatsStripe({ totalClaimedSol, totalDistributed, refundsIssued, lastRefundAt, loading }: Props) {
  const { ref, inView } = useInView();

  const lastRefundLabel = lastRefundAt
    ? new Date(lastRefundAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div
      ref={ref}
      className={`reveal ${inView ? "visible" : ""}`}
      style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x"
        style={{ "--tw-divide-opacity": "1", borderColor: "var(--border)" } as React.CSSProperties}
      >
        <div className="px-6 sm:px-8">
          <Stat label="Fees collected"      value={totalClaimedSol}  suffix="SOL" loading={loading} />
        </div>
        <div className="px-6 sm:px-8">
          <Stat label="Total dropped"       value={totalDistributed} suffix="SOL" loading={loading} />
        </div>
        <div className="px-6 sm:px-8">
          <Stat label="Drops sent"          value={refundsIssued}    decimals={0} loading={loading} />
        </div>
        <div className="px-6 sm:px-8 py-6 sm:py-0 flex flex-col gap-1 justify-center">
          <span
            className="text-xs uppercase tracking-widest"
            style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
          >
            Last drop—
          </span>
          <span
            className="text-sm"
            style={{ fontFamily: "JetBrains Mono, monospace", color: loading ? "var(--text-3)" : "var(--text-2)" }}
          >
            {loading ? "—" : lastRefundLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
