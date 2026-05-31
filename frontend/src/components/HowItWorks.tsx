"use client";

import { useInView } from "@/hooks/useInView";

const PHASES = [
  {
    time: "t+0s",
    title: "Volume happens.",
    body: "A buy or sell executes on pump.fun. One percent of the trade value is routed to the Paybag creator fee account. The trader pays it without thinking about it.",
  },
  {
    time: "t+45s",
    title: "Holders are ranked.",
    body: "An automated scan reads every wallet holding $Paybag. Each wallet's total SOL invested is compared against the current value of its tokens. The result is a ranked list, deepest loss at the top.",
  },
  {
    time: "t+120s",
    title: "The treasury empties.",
    body: "The collected fees are claimed and distributed to the top twenty wallets on the ranked list, proportional to their loss. No claim. No vote. The SOL just arrives. Then the cycle resets.",
  },
];

export default function HowItWorks() {
  const { ref, inView } = useInView();

  return (
    <section
      id="how"
      ref={ref}
      className={`reveal ${inView ? "visible" : ""}`}
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="px-6 sm:px-8 pt-8 pb-6">
        <h2
          className="section-label text-xl font-medium"
          style={{ fontFamily: "Newsreader, serif", letterSpacing: "-0.02em" }}
        >
          How the bank works.
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-2)" }}>
          Three events. Every two minutes. No exceptions.
        </p>
      </div>

      <div style={{ borderTop: "1px solid var(--border)" }}>
        {PHASES.map((phase, i) => (
          <div
            key={i}
            className="px-6 sm:px-8 py-7 flex gap-6 sm:gap-10"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex-shrink-0 pt-0.5" style={{ minWidth: "4rem" }}>
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "11px",
                  color: "var(--text-3)",
                  letterSpacing: "0.04em",
                }}
              >
                {phase.time}
              </span>
            </div>

            <div className="flex-1">
              <h3
                className="text-base font-medium mb-2"
                style={{ fontFamily: "Newsreader, serif", color: "var(--text-1)", letterSpacing: "-0.01em" }}
              >
                {phase.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-2)", maxWidth: "520px" }}
              >
                {phase.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
