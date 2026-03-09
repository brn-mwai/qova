import { z } from "zod";

const envSchema = z.object({
	NEXT_PUBLIC_CONVEX_URL: z.string().url(),
	NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
	CLERK_SECRET_KEY: z.string().startsWith("sk_"),
});

export function validateEnv(): void {
	const result = envSchema.safeParse(process.env);
	if (!result.success) {
		console.error(
			"[ENV] Missing required variables:",
			result.error.flatten(),
		);
	}
}
