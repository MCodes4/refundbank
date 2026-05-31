"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ActiveToken } from "@/lib/supabase";

const NAV = [
  { label: "Ledger", href: "/ledger" },
  { label: "Vault",  href: "/vault"  },
  { label: "Docs",   href: "/how"    },
  { label: "Check",  href: "/check"  },
  { label: "X",      href: "https://x.com/paybackfun", external: true },
];

export default function Header({ token }: { token: ActiveToken | null }) {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(248,248,248,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(14px)" : "none",
        borderBottom: `1px solid ${scrolled ? "var(--border)" : "transparent"}`,
      }}
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
          <img
            src="/logo.png"
            width="22"
            height="22"
            alt="Paybag logo"
            style={{ borderRadius: "4px", display: "block" }}
          />
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "13px",
              color: "var(--text-2)",
              letterSpacing: "-0.01em",
            }}
          >
            Paybag
            <span style={{ color: "var(--text-3)", fontSize: "10px", marginLeft: "4px" }}>
              $Paybag
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-5 sm:gap-7">
          {NAV.map(({ label, href, external }) => {
            const isActive = !external && pathname === href;
            return (
              <a
                key={label}
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className="text-sm transition-colors duration-150"
                style={{
                  color: isActive ? "var(--text-1)" : "var(--text-3)",
                  fontFamily: "Inter, sans-serif",
                  textDecoration: "none",
                  fontWeight: isActive ? 500 : 400,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = isActive ? "var(--text-1)" : "var(--text-3)")}
              >
                {label}
              </a>
            );
          })}
          <a
            href="https://pump.fun"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:block text-xs px-3 py-1.5 transition-all duration-150"
            style={{
              fontFamily: "JetBrains Mono, monospace",
              color: "var(--text-2)",
              border: "1px solid var(--border-2)",
              borderRadius: "3px",
              letterSpacing: "0.03em",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-1)"; e.currentTarget.style.borderColor = "var(--text-1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-2)"; e.currentTarget.style.borderColor = "var(--border-2)"; }}
          >
            buy
          </a>
        </nav>
      </div>
    </header>
  );
}
