import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.qova.cc"),
  title: "Qova - Financial Trust Infrastructure for AI Agents",
  description:
    "The credit bureau for AI agents. As agentic on-chain transactions grow, Qova computes verifiable reputation scores so any protocol can assess an agent's trustworthiness.",
  openGraph: {
    title: "Qova - Financial Trust Infrastructure for AI Agents",
    description:
      "The credit bureau for AI agents. Verifiable reputation scores from on-chain transaction data.",
    siteName: "Qova",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Qova - Financial Trust Infrastructure for AI Agents",
    description:
      "The credit bureau for AI agents. Verifiable reputation scores from on-chain transaction data.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
