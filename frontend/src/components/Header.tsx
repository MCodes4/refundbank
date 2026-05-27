"use client";

import { useState, useEffect } from "react";

import { type ActiveToken } from "@/lib/supabase";

const NAV = [
  { label: "Ledger", href: "#ledger" },
  { label: "Vault",  href: "#vault" },
  { label: "Docs",   href: "#how" },
  { label: "X",      href: "https://twitter.com", external: true },
];

export default function Header({ token }: { token: ActiveToken | null }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(10,14,20,0.9)" : "transparent",
        backdropFilter: scrolled ? "blur(14px)" : "none",
        borderBottom: `1px solid ${scrolled ? "var(--border)" : "transparent"}`,
      }}
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
        {/* Logo */}
        <a href="#top" className="flex items-center gap-2">
          {/* Vault monogram */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="1" width="16" height="16" rx="2" stroke="#D4AF37" strokeWidth="1.2" />
            <rect x="4" y="4" width="10" height="10" rx="1" stroke="#D4AF37" strokeWidth="0.8" opacity="0.5" />
            <text x="9" y="13" textAnchor="middle" fontSize="8" fontFamily="serif" fill="#D4AF37" fontWeight="600">$</text>
          </svg>
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "13px",
              color: "var(--text-2)",
              letterSpacing: "-0.01em",
            }}
          >
            refundbank
            <span style={{ color: "var(--text-3)", fontSize: "10px", marginLeft: "4px" }}>
              {token?.symbol ? `$${token.symbol}` : "v0.1"}
            </span>
          </span>
        </a>

        {/* Nav */}
        <nav className="flex items-center gap-5 sm:gap-7">
          {NAV.map(({ label, href, external }) => (
            <a
              key={label}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="text-sm transition-colors duration-150"
              style={{ color: "var(--text-3)", fontFamily: "Inter, sans-serif" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
            >
              {label}
            </a>
          ))}
          <a
            href="https://pump.fun"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:block text-xs px-3 py-1.5 transition-all duration-150"
            style={{
              fontFamily: "JetBrains Mono, monospace",
              color: "var(--text-2)",
              border: "1px solid var(--border-2)",
              borderRadius: "4px",
              letterSpacing: "0.03em",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--gold)"; e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-2)"; e.currentTarget.style.borderColor = "var(--border-2)"; }}
          >
            connect
          </a>
        </nav>
      </div>
    </header>
  );
}
