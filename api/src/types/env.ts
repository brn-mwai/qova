/**
 * Shared Hono environment types for typed context variables.
 * @author Qova Engineering <eng@qova.cc>
 */

/** Hono environment with typed context variables set by middleware. */
export type AppEnv = {
	Variables: {
		body: unknown;
		apiKey: import("../middleware/auth.js").ApiKeyInfo | undefined;
		userId: string | undefined;
	};
};
