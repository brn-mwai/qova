import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

/**
 * Service endpoint for API server to manage keys.
 * Authenticated via CONVEX_SERVICE_SECRET header.
 */
function requireServiceAuth(request: Request): boolean {
  const secret = request.headers.get("X-Service-Secret");
  const expected = process.env.CONVEX_SERVICE_SECRET;
  if (!expected || !secret) return false;
  return secret === expected;
}

/** POST /api-keys/store — Store a pre-generated API key. */
http.route({
  path: "/api-keys/store",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!requireServiceAuth(request)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const id = await ctx.runMutation(internal.mutations.apiKeys.createInternal, {
      userId: body.userId,
      name: body.name,
      scopes: body.scopes,
      expiresAt: body.expiresAt ?? undefined,
      keyPrefix: body.keyPrefix,
      keyHash: body.keyHash,
    });

    return new Response(JSON.stringify({ id }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

/** POST /api-keys/list — List keys for a user. */
http.route({
  path: "/api-keys/list",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!requireServiceAuth(request)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const keys = await ctx.runQuery(internal.queries.apiKeys.listByUserInternal, {
      userId: body.userId,
    });

    return new Response(JSON.stringify({ keys }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

/** POST /api-keys/revoke — Revoke a key. */
http.route({
  path: "/api-keys/revoke",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!requireServiceAuth(request)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const result = await ctx.runMutation(internal.mutations.apiKeys.revokeInternal, {
      id: body.id,
      userId: body.userId,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

/** POST /api-keys/touch — Update lastUsedAt for a key. */
http.route({
  path: "/api-keys/touch",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!requireServiceAuth(request)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    await ctx.runMutation(internal.mutations.apiKeys.touchLastUsed, {
      keyHash: body.keyHash,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
