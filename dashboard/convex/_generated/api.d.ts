/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_chain from "../actions/chain.js";
import type * as actions_integrationDispatch from "../actions/integrationDispatch.js";
import type * as actions_integrationTest from "../actions/integrationTest.js";
import type * as actions_sync from "../actions/sync.js";
import type * as actions_webhookTest from "../actions/webhookTest.js";
import type * as integrationConfigs from "../integrationConfigs.js";
import type * as lib_integrationHelpers from "../lib/integrationHelpers.js";
import type * as lib_trackEvent from "../lib/trackEvent.js";
import type * as mutations_activity from "../mutations/activity.js";
import type * as mutations_agents from "../mutations/agents.js";
import type * as mutations_apiKeys from "../mutations/apiKeys.js";
import type * as mutations_cre from "../mutations/cre.js";
import type * as mutations_notifications from "../mutations/notifications.js";
import type * as mutations_scores from "../mutations/scores.js";
import type * as mutations_users from "../mutations/users.js";
import type * as mutations_webhooks from "../mutations/webhooks.js";
import type * as mutations_worldId from "../mutations/worldId.js";
import type * as queries_activity from "../queries/activity.js";
import type * as queries_agents from "../queries/agents.js";
import type * as queries_apiKeys from "../queries/apiKeys.js";
import type * as queries_cre from "../queries/cre.js";
import type * as queries_notifications from "../queries/notifications.js";
import type * as queries_scores from "../queries/scores.js";
import type * as queries_stats from "../queries/stats.js";
import type * as queries_users from "../queries/users.js";
import type * as queries_webhooks from "../queries/webhooks.js";
import type * as queries_worldId from "../queries/worldId.js";
import type * as team from "../team.js";
import type * as userSettings from "../userSettings.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/chain": typeof actions_chain;
  "actions/integrationDispatch": typeof actions_integrationDispatch;
  "actions/integrationTest": typeof actions_integrationTest;
  "actions/sync": typeof actions_sync;
  "actions/webhookTest": typeof actions_webhookTest;
  integrationConfigs: typeof integrationConfigs;
  "lib/integrationHelpers": typeof lib_integrationHelpers;
  "lib/trackEvent": typeof lib_trackEvent;
  "mutations/activity": typeof mutations_activity;
  "mutations/agents": typeof mutations_agents;
  "mutations/apiKeys": typeof mutations_apiKeys;
  "mutations/cre": typeof mutations_cre;
  "mutations/notifications": typeof mutations_notifications;
  "mutations/scores": typeof mutations_scores;
  "mutations/users": typeof mutations_users;
  "mutations/webhooks": typeof mutations_webhooks;
  "mutations/worldId": typeof mutations_worldId;
  "queries/activity": typeof queries_activity;
  "queries/agents": typeof queries_agents;
  "queries/apiKeys": typeof queries_apiKeys;
  "queries/cre": typeof queries_cre;
  "queries/notifications": typeof queries_notifications;
  "queries/scores": typeof queries_scores;
  "queries/stats": typeof queries_stats;
  "queries/users": typeof queries_users;
  "queries/webhooks": typeof queries_webhooks;
  "queries/worldId": typeof queries_worldId;
  team: typeof team;
  userSettings: typeof userSettings;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
