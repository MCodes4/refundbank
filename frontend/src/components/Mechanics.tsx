"use client";

import { useInView } from "@/hooks/useInView";

const STEPS = [
  {
    n: "01",
    title: "Claim",
    body: "Creator fees accumulate on pump.fun's program. A scheduled job calls the claim instruction every two minutes. SOL lands in the treasury wallet.",
    code: "pumpfun.claim_creator_fee",
  },
  {
    n: "02",
    title: "Rank",
    body: "The indexer scans every holder, computes weighted average buy price against current value, and produces a ranked list of unrealized losses. Dust wallets under 0.05 SOL invested are excluded.",
    code: "helius.getTokenAccounts → rank by pnl_sol",
  },
  {
    n: "03",
    title: "Refund",
    body: "The top twenty losses receive SOL proportional to how deep they are. A single batched transaction. The treasury empties to zero each cycle.",
    code: "treasury.batchTransfer(recipients)",
  },
];

export default function Mechanics() {
  const { ref, inView } = useInView();

  return (
    <section
      id="mechanics"
      ref={ref}
      className={`py-24 reveal ${inView ? "visible" : ""}`}
    >
      <div className="section-wrap mb-14">
        <span className="section-num">01.</span>
        <div>
          <h2
            className="text-3xl sm:text-4xl font-medium mb-3"
            style={{ fontFamily: "Newsreader, serif", letterSpacing: "-0.02em" }}
          >
            Three checks. Two minutes.
          </h2>
          <p style={{ color: "var(--text-2)", maxWidth: "540px" }}>
            Every 120 seconds, the protocol does the same thing.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-px" style={{ background: "var(--border)" }}>
        {STEPS.map((step) => (
          <div
            key={step.n}
            className="p-7 flex flex-col gap-5"
            style={{ background: "var(--bg)" }}
          >
            <span
              className="text-4xl font-medium leading-none"
              style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--text-3)" }}
            >
              {step.n}
            </span>
            <div>
              <h3
                className="text-lg font-medium mb-2"
                style={{ fontFamily: "Newsreader, serif" }}
              >
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                {step.body}
              </p>
            </div>
            <span className="code-tag mt-auto">{step.code}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
