"use client";

import { useActiveToken } from "@/hooks/useActiveToken";
import Header        from "@/components/Header";
import HowItWorks    from "@/components/HowItWorks";
import WhyThisExists from "@/components/WhyThisExists";
import Footer        from "@/components/Footer";

export default function HowPage() {
  const { token } = useActiveToken();

  return (
    <>
      <Header token={token} />
      <main className="max-w-5xl mx-auto">
        <div
          className="px-6 sm:px-8 pt-32 pb-10"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <p
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "10px",
              color: "var(--text-3)",
              letterSpacing: "0.1em",
              marginBottom: "12px",
            }}
          >
            REFUNDBANK / DOCS
          </p>
          <h1
            className="text-4xl sm:text-6xl font-medium"
            style={{
              fontFamily: "Newsreader, serif",
              letterSpacing: "-0.03em",
              color: "var(--text-1)",
              maxWidth: "600px",
            }}
          >
            How it works.
          </h1>
          <p
            className="mt-4 text-sm"
            style={{ color: "var(--text-2)", maxWidth: "480px", lineHeight: 1.7 }}
          >
            Three events. Every two minutes. No exceptions.
            Volume, ranking, distribution.
          </p>
        </div>

        <HowItWorks />
        <WhyThisExists />
        <Footer activeMint={token?.mint_address ?? null} />
      </main>
    </>
  );
}
