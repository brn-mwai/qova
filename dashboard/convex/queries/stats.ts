import { query } from "../_generated/server";

/** Get system-wide overview stats from the systemStats table. */
export const getOverview = query({
  args: {},
  handler: async (ctx): Promise<Record<string, string | number>> => {
    const rows = await ctx.db
      .query("systemStats")
      .withIndex("by_key")
      .collect();

    const result: Record<string, string | number> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  },
});
