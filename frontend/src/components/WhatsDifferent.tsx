"use client";

import { useInView } from "@/hooks/useInView";

const POINTS = [
  {
    title: "Speed.",
    body: "Refunds dispatch every two minutes. Other systems redistribute weekly, monthly, or never. The capital is in your wallet before the next candle closes.",
  },
  {
    title: "Targeting.",
    body: "Fees don't get sprayed equally across all holders. They go to the wallets most underwater in absolute SOL. Equal split rewards whales who barely felt it. Loss-weighted split refunds the people actually hurt.",
  },
  {
    title: "No claiming.",
    body: "There is no claim button. There is no signing, no gas, no deadline. The treasury wallet sends SOL directly to your wallet. If your wallet receives SOL, it's because you were owed it.",
  },
];

export default function WhatsDifferent() {
  const { ref, inView } = useInView();

  return (
    <section
      ref={ref}
      className={`py-24 reveal ${inView ? "visible" : ""}`}
    >
      <div className="section-wrap mb-12">
        <span className="section-num">06.</span>
        <h2
          className="text-3xl sm:text-4xl font-medium"
          style={{ fontFamily: "Newsreader, serif", letterSpacing: "-0.02em" }}
        >
          Why this isn't just another fee distributor.
        </h2>
      </div>

      <div className="section-wrap">
        <span />
        <div className="space-y-8 max-w-2xl">
          {POINTS.map((p, i) => (
            <p key={i} className="text-base leading-relaxed" style={{ color: "var(--text-2)" }}>
              <span style={{ color: "var(--text-1)", fontWeight: 500 }}>{p.title}</span>{" "}
              {p.body}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
