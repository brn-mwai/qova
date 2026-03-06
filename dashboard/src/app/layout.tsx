import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers/providers";
import { bodyFont, headingFont, monoFont } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
	metadataBase: new URL("https://app.qova.cc"),
	title: "Qova - Financial Trust Infrastructure",
	description:
		"The financial credit bureau for AI agents. As agentic on-chain transactions grow, Qova computes verifiable reputation scores so any protocol can assess an agent's trustworthiness.",
	openGraph: {
		title: "Qova - Financial Trust Infrastructure",
		description:
			"The financial credit bureau for AI agents. Verifiable reputation scores from on-chain transaction data.",
		siteName: "Qova",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Qova - Financial Trust Infrastructure",
		description:
			"The financial credit bureau for AI agents. Verifiable reputation scores from on-chain transaction data.",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>): React.ReactElement {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${headingFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
		>
			<body className="min-h-screen antialiased">
				<Providers>{children}</Providers>
				<Toaster
					position="bottom-right"
					toastOptions={{
						className:
							"border border-border bg-card text-card-foreground !shadow-none",
					}}
				/>
			</body>
		</html>
	);
}
