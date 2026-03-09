/**
 * Middleware auth enforcement tests.
 * Verifies that missing Clerk keys block all routes except /api/health.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock next/server with NextResponse as a class
vi.mock("next/server", () => {
	class MockNextResponse {
		status: number | undefined;
		body: string | null;
		constructor(body?: string | null, init?: { status?: number }) {
			this.body = body ?? null;
			this.status = init?.status;
		}
		static next() {
			return new MockNextResponse(null);
		}
		static redirect(url: URL) {
			const resp = new MockNextResponse(null, { status: 307 });
			return resp;
		}
	}
	return { NextResponse: MockNextResponse };
});

describe("middleware auth enforcement", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("returns 503 when Clerk keys are missing for non-health routes", async () => {
		delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
		delete process.env.CLERK_SECRET_KEY;

		const { default: middleware } = await import("../src/middleware");

		const request = {
			nextUrl: { pathname: "/agents" },
			url: "http://localhost:3000/agents",
		} as any;

		const response = await middleware(request, {} as any);
		expect(response.status).toBe(503);
	});

	it("allows /api/health even when Clerk keys are missing", async () => {
		delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
		delete process.env.CLERK_SECRET_KEY;

		const { default: middleware } = await import("../src/middleware");

		const request = {
			nextUrl: { pathname: "/api/health" },
			url: "http://localhost:3000/api/health",
		} as any;

		const response = await middleware(request, {} as any);
		// Health check returns NextResponse.next() which has no status
		expect(response.status).toBeUndefined();
	});

	it("blocks dashboard routes when Clerk keys are missing", async () => {
		delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
		delete process.env.CLERK_SECRET_KEY;

		const { default: middleware } = await import("../src/middleware");

		const routes = ["/", "/scores", "/agents", "/settings", "/api/cre/execute"];
		for (const path of routes) {
			const request = {
				nextUrl: { pathname: path },
				url: `http://localhost:3000${path}`,
			} as any;
			const response = await middleware(request, {} as any);
			expect(response.status).toBe(503);
		}
	});
});
