import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "refundbank. — $RFND",
  description:
    "A coin that pays you back. Every trade contributes to a treasury. Every two minutes the treasury empties to the wallets deepest in the red.",
  openGraph: {
    title: "refundbank. — $RFND",
    description: "Built for bagholders.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
