export default function LogoSVG({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Paybag logo"
    >
      {/* Outer vault ring */}
      <circle cx="24" cy="24" r="22" stroke="#D4AF37" strokeWidth="1.2" opacity="0.45" />
      {/* Inner vault ring */}
      <circle cx="24" cy="24" r="15" stroke="#D4AF37" strokeWidth="0.8" opacity="0.3" />
      {/* Vault dial spokes — 4 cardinal */}
      <line x1="24" y1="2"  x2="24" y2="9"  stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" />
      <line x1="46" y1="24" x2="39" y2="24" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="46" x2="24" y2="39" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" />
      <line x1="2"  y1="24" x2="9"  y2="24" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" />
      {/* R — vertical bar */}
      <line x1="16" y1="14" x2="16" y2="34" stroke="#D4AF37" strokeWidth="2.2" strokeLinecap="round" />
      {/* R — upper bowl */}
      <path
        d="M16 14 Q26 14 26 20 Q26 26 16 26"
        stroke="#D4AF37"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* R — leg going down then curving back UP (loss → refund) */}
      <path
        d="M20 26 L29 34 Q30 36 28 37 L24 37"
        stroke="#D4AF37"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Upward arrow tip — the refund */}
      <path
        d="M24 37 L21 33 M24 37 L27 33"
        stroke="#D4AF37"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
