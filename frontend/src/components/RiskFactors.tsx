"use client";

import { useInView } from "@/hooks/useInView";

const RISKS = [
  {
    title: "Volume dies.",
    body: "No trades means no fees means no drops. If the chart goes flat, so does the bag.",
  },
  {
    title: "The coin graduates.",
    body: "Once pump.fun graduates the token to Raydium, creator fees stop. The drop mechanism halts unless LP fees are re-routed (planned for v0.2).",
  },
  {
    title: "You bought too small.",
    body: "The dust filter excludes wallets under 0.05 SOL invested. If you bought $5 worth and the coin dies, you're not in the queue.",
  },
  {
    title: "You bought too late.",
    body: "Drops go to absolute SOL loss, not percentage. Someone who lost 10 SOL outranks someone who lost 90% of 0.1 SOL.",
  },
  {
    title: "The treasury wallet is a single key.",
    body: "v0.1 is operated. v1.0 moves to a program-controlled treasury. Right now you are trusting the key holder not to drain it.",
  },
];

export default function RiskFactors() {
  const { ref, inView } = useInView();

  return (
    <section
      ref={ref}
      className={`py-24 reveal ${inView ? "visible" : ""}`}
    >
      <div className="section-wrap mb-12">
        <span className="section-num">05.</span>
        <div>
          <h2
            className="text-3xl sm:text-4xl font-medium mb-3"
            style={{ fontFamily: "Newsreader, serif", letterSpacing: "-0.02em" }}
          >
            Things that can wreck you.
          </h2>
          <p style={{ color: "var(--text-2)" }}>
            Other coins call this "risk factors" and bury it on page 14. We list it here.
          </p>
        </div>
      </div>

      <div className="section-wrap">
        <span /> {/* empty number column */}
        <div>
          {RISKS.map((risk, i) => (
            <div
              key={i}
              className="trow py-5"
            >
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                <span style={{ color: "var(--text-1)", fontWeight: 500 }}>{risk.title}</span>{" "}
                {risk.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
