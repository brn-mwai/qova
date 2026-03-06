import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.qova.cc"),
  title: {
    default: "Qova Docs",
    template: "%s - Qova Docs",
  },
  description:
    "Documentation for Qova - financial trust infrastructure for AI agents.",
  openGraph: {
    title: "Qova Docs",
    description:
      "SDK reference, API docs, smart contracts, and CRE workflows for Qova - financial trust infrastructure for AI agents.",
    siteName: "Qova Docs",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Qova Docs",
    description:
      "SDK reference, API docs, smart contracts, and CRE workflows for Qova.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <RootProvider
          theme={{
            defaultTheme: "dark",
            attribute: "class",
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
