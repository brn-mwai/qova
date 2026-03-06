import { query } from "../_generated/server";

interface UserSettings {
	emailScoreAlerts: boolean;
	emailBudgetAlerts: boolean;
	emailSecurityAlerts: boolean;
	emailWeeklyDigest: boolean;
	pushScoreAlerts: boolean;
	pushBudgetAlerts: boolean;
	pushSecurityAlerts: boolean;
	defaultChartRange: string;
	compactView: boolean;
	timezone: string;
}

const DEFAULTS: UserSettings = {
	emailScoreAlerts: true,
	emailBudgetAlerts: true,
	emailSecurityAlerts: true,
	emailWeeklyDigest: false,
	pushScoreAlerts: true,
	pushBudgetAlerts: true,
	pushSecurityAlerts: true,
	defaultChartRange: "30d",
	compactView: false,
	timezone: "UTC",
};

/** Get current user's settings. Returns defaults if none saved yet. */
export const getSettings = query({
	args: {},
	handler: async (ctx): Promise<UserSettings> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return DEFAULTS;

		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_userId", (q) => q.eq("userId", identity.subject))
			.first();

		if (!settings) return DEFAULTS;

		return {
			emailScoreAlerts: settings.emailScoreAlerts,
			emailBudgetAlerts: settings.emailBudgetAlerts,
			emailSecurityAlerts: settings.emailSecurityAlerts,
			emailWeeklyDigest: settings.emailWeeklyDigest,
			pushScoreAlerts: settings.pushScoreAlerts,
			pushBudgetAlerts: settings.pushBudgetAlerts,
			pushSecurityAlerts: settings.pushSecurityAlerts,
			defaultChartRange: settings.defaultChartRange,
			compactView: settings.compactView,
			timezone: settings.timezone,
		};
	},
});
