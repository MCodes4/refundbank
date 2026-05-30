"use client";

import { useInView } from "@/hooks/useInView";

export default function WhyThisExists() {
  const { ref, inView } = useInView();

  return (
    <section
      ref={ref}
      className={`reveal ${inView ? "visible" : ""}`}
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="px-6 sm:px-8 pt-8 pb-12">
        <h2
          className="section-label text-xl font-medium mb-8"
          style={{ fontFamily: "Newsreader, serif", letterSpacing: "-0.02em" }}
        >
          Why a bank for bagholders.
        </h2>

        <div
          className="space-y-6 max-w-2xl text-sm leading-relaxed"
          style={{ color: "var(--text-2)" }}
        >
          <p>
            Memecoins reward speed. Snipe early, dump on retail, move on. The people
            who believe in the project, who hold through the dump, who buy more at
            the bottom, get punished. They are the exit liquidity. They are the
            bagholders.
          </p>
          <p>
            Payback inverts the geometry. The deeper your bag, the more the
            protocol pays you. Not as charity. As mechanism. Every trade, yours,
            mine, the sniper's, funds the pool. Every two minutes, the pool
            empties to whoever is bleeding hardest.
          </p>
          <p>
            The system has no opinion about whether you should be holding. It just
            notices that you are, and that you are down, and it sends you SOL. That
            is all a bank is supposed to do.
          </p>
        </div>
      </div>
    </section>
  );
}
