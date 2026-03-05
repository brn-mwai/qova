"use client";

import { createContext, useContext } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import {
	ConvexProvider as BaseConvexProvider,
	ConvexReactClient,
} from "convex/react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Web3Provider } from "@/providers/web3-provider";
import "@coinbase/onchainkit/styles.css";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const isConvexConfigured = convexUrl.length > 0;
const isClerkConfigured = clerkPubKey.length > 0;

const convex = new ConvexReactClient(
	convexUrl || "https://placeholder.convex.cloud",
);

const ConvexAvailableContext = createContext(false);

export function useConvexAvailable(): boolean {
	return useContext(ConvexAvailableContext);
}

function ConvexWithClerkInner({
	children,
}: {
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<ConvexProviderWithClerk client={convex} useAuth={useAuth}>
			{children}
		</ConvexProviderWithClerk>
	);
}

function InnerProviders({
	children,
}: {
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<ConvexAvailableContext.Provider value={isConvexConfigured}>
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				enableSystem
				disableTransitionOnChange
			>
				<Web3Provider>
					<TooltipProvider>{children}</TooltipProvider>
				</Web3Provider>
			</ThemeProvider>
		</ConvexAvailableContext.Provider>
	);
}

export function Providers({
	children,
}: {
	children: React.ReactNode;
}): React.ReactElement {
	if (isClerkConfigured) {
		return (
			<ClerkProvider
				publishableKey={clerkPubKey}
				appearance={{
					baseTheme: dark,
					variables: {
						colorPrimary: "#ffffff",
						colorBackground: "#09090b",
						colorInputBackground: "#18181b",
						colorInputText: "#fafafa",
						borderRadius: "0.5rem",
					},
					elements: {
						card: "shadow-none border border-border",
						socialButtonsBlockButton: "shadow-none border border-border",
						formFieldInput: "shadow-none border border-border",
						footer: "clerk-hidden",
						footerAction: "clerk-hidden",
					},
				}}
				signInUrl="/sign-in"
				signUpUrl="/sign-up"
				afterSignOutUrl="/sign-in"
			>
				<ConvexWithClerkInner>
					<InnerProviders>{children}</InnerProviders>
				</ConvexWithClerkInner>
			</ClerkProvider>
		);
	}

	return (
		<BaseConvexProvider client={convex}>
			<InnerProviders>{children}</InnerProviders>
		</BaseConvexProvider>
	);
}
