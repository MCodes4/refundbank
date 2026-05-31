"use client";

import { useCountUp } from "@/hooks/useCountUp";
import { useInView } from "@/hooks/useInView";

interface Props {
  inVaultSol:       number;
  paidOutSol:       number;
  walletsRefunded:  number;
  cyclesDispatched: number;
  loading:          boolean;
}

function StatItem({
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
  const counted = useCountUp(loading ? 0 : value, 1800);
  return (
    <div className="px-6 sm:px-8 py-7 flex flex-col gap-2">
      <span className="mono-tag">
        {label}
      </span>
      {loading ? (
        <span className="skeleton w-20 h-8" />
      ) : (
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "28px",
            fontWeight: 500,
            color: "var(--text-1)",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {decimals === 0 ? Math.floor(counted).toLocaleString() : counted.toFixed(decimals)}
          {suffix && (
            <span style={{ color: "var(--text-2)", fontSize: "14px", marginLeft: "5px" }}>
              {suffix}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

export default function VaultStats({ inVaultSol, paidOutSol, walletsRefunded, cyclesDispatched, loading }: Props) {
  const { ref, inView } = useInView();

  return (
    <section
      id="vault"
      ref={ref}
      className={`reveal ${inView ? "visible" : ""}`}
      style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="px-6 sm:px-8 pt-8 pb-2">
        <h2
          className="section-label text-xl font-medium"
          style={{ fontFamily: "Newsreader, serif", letterSpacing: "-0.02em" }}
        >
          The paybag.
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-2)" }}>
          How much SOL is in the bag, where it came from, where it is going.
        </p>
      </div>

      <div
        className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0"
        style={{ borderColor: "var(--border)" } as React.CSSProperties}
      >
        <StatItem label="In the paybag"     value={inVaultSol}       suffix="SOL" loading={loading} />
        <StatItem label="Paid out lifetime" value={paidOutSol}       suffix="SOL" loading={loading} />
        <StatItem label="Wallets paid"       value={walletsRefunded}  decimals={0} loading={loading} />
        <StatItem label="Drops sent"        value={cyclesDispatched} decimals={0} loading={loading} />
      </div>
    </section>
  );
}
