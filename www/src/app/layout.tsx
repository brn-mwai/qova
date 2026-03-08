import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.qova.cc"),
  title: "Qova - Financial Trust Infrastructure for AI Agents",
  description:
    "The credit bureau for AI agents. Verifiable on-chain reputation scores from transaction data. Built on Base L2, powered by Chainlink CRE.",
  openGraph: {
    title: "Qova - Financial Trust Infrastructure for AI Agents",
    description:
      "The credit bureau for AI agents. Verifiable on-chain reputation scores from on-chain transaction data.",
    siteName: "Qova",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Qova - Financial Trust Infrastructure for AI Agents",
    description:
      "The credit bureau for AI agents. Verifiable on-chain reputation scores from on-chain transaction data.",
  },
};

/* Inline script prevents flash of wrong theme on load */
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('qova-theme');
    var dark = t === 'dark' || (!t || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch(e){}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
