"use client";

import { useState } from "react";
import { useInView } from "@/hooks/useInView";

const FAQS = [
  {
    q: "What stops dust wallets from gaming this?",
    a: "The system enforces two filters automatically: wallets must hold tokens with a current value of at least 0.05 SOL, and must have invested at least 0.1 SOL total. Wallets below these thresholds are excluded from the refund queue entirely.",
  },
  {
    q: "Why proportional and not an equal split?",
    a: "Proportional allocation mirrors the damage. If you lost 2 SOL and someone else lost 0.5 SOL, you receive 4× their share. Equal splits would undercompensate large holders and over-reward small ones. Proportional is the only fair mechanism.",
  },
  {
    q: "What happens when the coin pumps?",
    a: "Fees keep flowing as long as people trade — buy or sell. A pumping coin means more volume, which means more fees entering the treasury, which means larger refund cycles. Holders in profit don't receive refunds, but they benefit from price appreciation.",
  },
  {
    q: "Is this audited?",
    a: "The smart contract is the pump.fun bonding curve — audited by pump.fun. The redistribution logic runs as open, verifiable edge functions. Every transaction is on-chain and can be verified on Solscan.",
  },
  {
    q: "Can I claim my refund manually?",
    a: "No. The system does it for you automatically, every 30 minutes. If you qualify, SOL arrives in your wallet without any action required. There is no claim button.",
  },
];

export default function FAQ() {
  const { ref, inView } = useInView();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section
      ref={ref}
      className={`space-y-5 reveal ${inView ? "visible" : ""}`}
    >
      <div className="px-1">
        <h2
          className="text-2xl font-semibold"
          style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}
        >
          Questions
        </h2>
      </div>

      <div className="glass overflow-hidden">
        {FAQS.map((faq, i) => (
          <div
            key={i}
            className="ledger-row"
          >
            <button
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-150"
              onClick={() => setOpen(open === i ? null : i)}
              style={{ background: "transparent", border: "none", cursor: "pointer" }}
            >
              <span
                className="text-sm font-medium"
                style={{
                  color: open === i ? "var(--text-primary)" : "var(--text-secondary)",
                  fontFamily: "var(--font-sans)",
                  transition: "color 0.15s ease",
                }}
              >
                {faq.q}
              </span>
              <span
                className="flex-shrink-0 text-lg transition-transform duration-300"
                style={{
                  color: "var(--text-muted)",
                  transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
                }}
              >
                +
              </span>
            </button>
            <div className={`faq-body ${open === i ? "open" : ""}`}>
              <p
                className="px-5 pb-4 text-sm leading-relaxed"
                style={{ color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}
              >
                {faq.a}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
