import { describe, expect, it, beforeEach } from "vitest";
import { app } from "../../src/app.js";
import { AUTH_HEADERS, authedHeaders } from "../helpers.js";
import { clearWebhooks } from "../../src/routes/webhooks.js";

describe("Webhook routes", () => {
	beforeEach(() => {
		clearWebhooks();
	});

	describe("POST /api/webhooks", () => {
		it("creates a webhook and returns secret", async () => {
			const res = await app.request("/api/webhooks", {
				method: "POST",
				headers: authedHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({
					url: "https://example.com/hook",
					events: ["agent.registered"],
				}),
			});
			expect(res.status).toBe(201);
			const body = await res.json();
			expect(body.id).toMatch(/^wh_/);
			expect(body.secret).toMatch(/^whsec_/);
			expect(body.url).toBe("https://example.com/hook");
			expect(body.events).toEqual(["agent.registered"]);
			expect(body.isActive).toBe(true);
		});

		it("rejects non-HTTPS URLs", async () => {
			const res = await app.request("/api/webhooks", {
				method: "POST",
				headers: authedHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({
					url: "http://example.com/hook",
					events: ["agent.registered"],
				}),
			});
			expect(res.status).toBe(400);
		});

		it("rejects invalid event types", async () => {
			const res = await app.request("/api/webhooks", {
				method: "POST",
				headers: authedHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({
					url: "https://example.com/hook",
					events: ["invalid.event"],
				}),
			});
			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/webhooks", () => {
		it("lists created webhooks without secret", async () => {
			// Create one first
			await app.request("/api/webhooks", {
				method: "POST",
				headers: authedHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ url: "https://example.com/a", events: ["agent.registered"] }),
			});

			const res = await app.request("/api/webhooks", { headers: AUTH_HEADERS });
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.webhooks).toHaveLength(1);
			// Secret should NOT be exposed in list
			expect(body.webhooks[0].secret).toBeUndefined();
		});
	});

	describe("GET /api/webhooks/:id", () => {
		it("returns webhook by ID without secret", async () => {
			const createRes = await app.request("/api/webhooks", {
				method: "POST",
				headers: authedHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ url: "https://example.com/b", events: ["agent.registered"] }),
			});
			const { id } = await createRes.json();

			const res = await app.request(`/api/webhooks/${id}`, { headers: AUTH_HEADERS });
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.id).toBe(id);
			expect(body.secret).toBeUndefined();
		});

		it("returns 404 for unknown ID", async () => {
			const res = await app.request("/api/webhooks/wh_nonexistent", { headers: AUTH_HEADERS });
			expect(res.status).toBe(404);
			const body = await res.json();
			expect(body.code).toBe("WEBHOOK_NOT_FOUND");
		});
	});

	describe("PATCH /api/webhooks/:id", () => {
		it("updates webhook fields", async () => {
			const createRes = await app.request("/api/webhooks", {
				method: "POST",
				headers: authedHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ url: "https://example.com/c", events: ["agent.registered"] }),
			});
			const { id } = await createRes.json();

			const res = await app.request(`/api/webhooks/${id}`, {
				method: "PATCH",
				headers: authedHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ isActive: false, events: ["agent.registered", "transaction.recorded"] }),
			});
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.isActive).toBe(false);
			expect(body.events).toEqual(["agent.registered", "transaction.recorded"]);
		});
	});

	describe("DELETE /api/webhooks/:id", () => {
		it("deletes a webhook", async () => {
			const createRes = await app.request("/api/webhooks", {
				method: "POST",
				headers: authedHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ url: "https://example.com/d", events: ["agent.registered"] }),
			});
			const { id } = await createRes.json();

			const res = await app.request(`/api/webhooks/${id}`, {
				method: "DELETE",
				headers: AUTH_HEADERS,
			});
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.deleted).toBe(true);

			// Verify gone
			const getRes = await app.request(`/api/webhooks/${id}`, { headers: AUTH_HEADERS });
			expect(getRes.status).toBe(404);
		});
	});

	describe("GET /api/webhooks/:id/deliveries", () => {
		it("returns delivery log", async () => {
			const createRes = await app.request("/api/webhooks", {
				method: "POST",
				headers: authedHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ url: "https://example.com/e", events: ["agent.registered"] }),
			});
			const { id } = await createRes.json();

			const res = await app.request(`/api/webhooks/${id}/deliveries`, { headers: AUTH_HEADERS });
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.deliveries).toBeInstanceOf(Array);
		});
	});

	describe("POST /api/webhooks/:id/test", () => {
		it("sends a test ping", async () => {
			const createRes = await app.request("/api/webhooks", {
				method: "POST",
				headers: authedHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ url: "https://example.com/f", events: ["agent.registered"] }),
			});
			const { id } = await createRes.json();

			const res = await app.request(`/api/webhooks/${id}/test`, {
				method: "POST",
				headers: AUTH_HEADERS,
			});
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.sent).toBe(true);
		});
	});

	describe("POST /api/webhooks/:id/rotate-secret", () => {
		it("rotates the signing secret", async () => {
			const createRes = await app.request("/api/webhooks", {
				method: "POST",
				headers: authedHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ url: "https://example.com/g", events: ["agent.registered"] }),
			});
			const created = await createRes.json();

			const res = await app.request(`/api/webhooks/${created.id}/rotate-secret`, {
				method: "POST",
				headers: AUTH_HEADERS,
			});
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.secret).toMatch(/^whsec_/);
			expect(body.secret).not.toBe(created.secret);
		});
	});
});
