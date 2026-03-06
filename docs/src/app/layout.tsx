import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Qova Docs",
    template: "%s - Qova Docs",
  },
  description:
    "Documentation for Qova - financial trust infrastructure for AI agents.",
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
