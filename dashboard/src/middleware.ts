import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";

/**
 * Middleware that conditionally enables Clerk auth.
 * When Clerk keys are not configured (e.g. fresh deployment),
 * all routes are accessible without authentication.
 */
export default async function middleware(
	request: NextRequest,
	event: NextFetchEvent,
): Promise<NextResponse> {
	if (
		!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
		!process.env.CLERK_SECRET_KEY
	) {
		// Allow health check even without auth config
		if (request.nextUrl.pathname === "/api/health") return NextResponse.next();
		return new NextResponse("Auth not configured", { status: 503 });
	}

	// Dynamic import avoids Clerk crashing at module init when keys are absent
	const { clerkMiddleware, createRouteMatcher } = await import(
		"@clerk/nextjs/server"
	);

	const isPublicRoute = createRouteMatcher([
		"/sign-in(.*)",
		"/sign-up(.*)",
		"/verify(.*)",
		"/api/webhooks(.*)",
		"/api/badge(.*)",
		"/api/cre(.*)",
	]);

	const handler = clerkMiddleware(async (auth, req) => {
		if (!isPublicRoute(req)) {
			const { userId } = await auth();
			if (!userId) {
				const signInUrl = new URL("/sign-in", req.url);
				signInUrl.searchParams.set("redirect_url", req.url);
				return NextResponse.redirect(signInUrl);
			}
		}
	});

	return handler(request, event) as Promise<NextResponse>;
}

export const config = {
	matcher: [
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		"/(api|trpc)(.*)",
	],
};
