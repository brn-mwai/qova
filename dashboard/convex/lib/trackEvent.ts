import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Log an audit trail entry AND dispatch a user notification in one call.
 * Call this from any user-facing mutation after the primary operation succeeds.
 *
 * @param ctx - The Convex mutation context.
 * @param opts.userId - Clerk subject (identity.subject).
 * @param opts.action - Dotted action key, e.g. "agent.register", "api_key.create".
 * @param opts.resource - Resource type, e.g. "agent", "api_key", "webhook".
 * @param opts.resourceId - Optional resource identifier (address, key prefix, etc.).
 * @param opts.metadata - Optional JSON-serializable details object.
 * @param opts.notification - If provided, also creates a notification for the user.
 */
export async function trackEvent(
	ctx: MutationCtx,
	opts: {
		userId: string;
		action: string;
		resource: string;
		resourceId?: string;
		metadata?: Record<string, unknown>;
		notification?: {
			type: "score_change" | "budget_alert" | "verification" | "system";
			title: string;
			message: string;
			agentAddress?: string;
		};
	},
): Promise<void> {
	// 1. Always write to auditLog
	await ctx.db.insert("auditLog", {
		userId: opts.userId,
		action: opts.action,
		resource: opts.resource,
		resourceId: opts.resourceId,
		metadata: opts.metadata ? JSON.stringify(opts.metadata) : undefined,
		timestamp: Date.now(),
	});

	// 2. Optionally dispatch a notification
	if (opts.notification) {
		await ctx.db.insert("notifications", {
			userId: opts.userId,
			type: opts.notification.type,
			title: opts.notification.title,
			message: opts.notification.message,
			agentAddress: opts.notification.agentAddress,
			read: false,
			createdAt: Date.now(),
		});

		// Dispatch to external integrations (Slack, Telegram, email) via scheduler
		await ctx.scheduler.runAfter(
			0,
			internal.actions.integrationDispatch.dispatchNotification,
			{
				userId: opts.userId,
				event: {
					type: opts.notification.type,
					title: opts.notification.title,
					message: opts.notification.message,
					agentAddress: opts.notification.agentAddress,
				},
			},
		);
	}
}
