"use client";

import { useInView } from "@/hooks/useInView";

export default function FinalCTA() {
  const { ref, inView } = useInView();

  return (
    <section
      ref={ref}
      className={`reveal ${inView ? "visible" : ""}`}
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="px-6 sm:px-8 py-20 sm:py-28 text-center">
        <h2
          className="text-5xl sm:text-7xl font-medium mb-5"
          style={{
            fontFamily: "Newsreader, Georgia, serif",
            letterSpacing: "-0.03em",
            color: "var(--text-1)",
          }}
        >
          Hold harder.
        </h2>
        <p
          className="text-base mb-10"
          style={{ color: "var(--text-3)", fontFamily: "Inter, sans-serif" }}
        >
          Or don't. The system pays the people who do.
        </p>
        <a
          href="https://pump.fun"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm transition-all duration-150"
          style={{
            fontFamily: "Inter, sans-serif",
            color: "var(--gold)",
            border: "1px solid rgba(212,175,55,0.4)",
            borderRadius: "4px",
            padding: "10px 22px",
            background: "rgba(212,175,55,0.07)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,175,55,0.13)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(212,175,55,0.07)")}
        >
          View on pump.fun
        </a>
      </div>
    </section>
  );
}
