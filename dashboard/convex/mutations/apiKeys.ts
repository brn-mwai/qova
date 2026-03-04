import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";

/**
 * SHA-256 hash a string. Uses the Web Crypto API available in Convex runtime.
 */
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a cryptographically random API key.
 */
function generateKey(): string {
  const randomBytes = new Uint8Array(30);
  crypto.getRandomValues(randomBytes);
  return (
    "qova_" +
    Array.from(randomBytes)
      .map((b) => b.toString(36).padStart(2, "0"))
      .join("")
      .slice(0, 40)
  );
}

/**
 * Create a new API key from the dashboard (requires Clerk auth).
 * Returns the full key — shown to user once, never stored in plaintext.
 */
export const create = mutation({
  args: {
    name: v.string(),
    scopes: v.array(v.string()),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const userId = identity.subject;
    const key = generateKey();
    const keyPrefix = key.slice(0, 12);
    const keyHash = await sha256(key);

    const expiresAt = args.expiresInDays
      ? Date.now() + args.expiresInDays * 86400000
      : undefined;

    const id = await ctx.db.insert("apiKeys", {
      userId,
      name: args.name,
      keyPrefix,
      keyHash,
      scopes: args.scopes,
      expiresAt,
      createdAt: Date.now(),
      isActive: true,
    });

    return { key, keyPrefix, id };
  },
});

/**
 * Create a key via the API server (internal, no Clerk auth needed).
 * Called by the Hono API when an admin-scoped key creates a new key.
 */
export const createInternal = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    scopes: v.array(v.string()),
    expiresAt: v.optional(v.number()),
    keyPrefix: v.string(),
    keyHash: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("apiKeys", {
      userId: args.userId,
      name: args.name,
      keyPrefix: args.keyPrefix,
      keyHash: args.keyHash,
      scopes: args.scopes,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
      isActive: true,
    });
    return id;
  },
});

/** Revoke an API key (dashboard — uses Clerk auth). */
export const revoke = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const key = await ctx.db.get(id);
    if (!key || key.userId !== identity.subject) throw new Error("Forbidden");

    await ctx.db.patch(id, { isActive: false });
    return { revoked: true };
  },
});

/** Revoke a key via the API server (internal). */
export const revokeInternal = internalMutation({
  args: { id: v.id("apiKeys"), userId: v.string() },
  handler: async (ctx, { id, userId }) => {
    const key = await ctx.db.get(id);
    if (!key || key.userId !== userId) throw new Error("Forbidden");
    await ctx.db.patch(id, { isActive: false });
    return { revoked: true };
  },
});

/** Delete an API key permanently (dashboard). */
export const remove = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const key = await ctx.db.get(id);
    if (!key || key.userId !== identity.subject) throw new Error("Forbidden");

    await ctx.db.delete(id);
    return { deleted: true };
  },
});

/** Update lastUsedAt timestamp when a key is used for authentication. */
export const touchLastUsed = internalMutation({
  args: { keyHash: v.string() },
  handler: async (ctx, { keyHash }) => {
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", keyHash))
      .first();
    if (key) {
      await ctx.db.patch(key._id, { lastUsedAt: Date.now() });
    }
  },
});
