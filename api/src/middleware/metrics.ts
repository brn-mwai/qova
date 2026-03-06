/**
 * Prometheus-compatible metrics collection.
 *
 * Tracks: request counts, latency histograms, error rates, active connections.
 * Exposed at GET /api/metrics in Prometheus text format.
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Context, Next } from "hono";
import { Hono } from "hono";
import { getAllCircuitStates } from "./circuit-breaker.js";

// ── Counters ────────────────────────────────────────────────────────

interface MetricEntry {
	count: number;
	totalDuration: number;
	/** Histogram buckets in ms: [10, 25, 50, 100, 250, 500, 1000, 5000] */
	buckets: number[];
}

const HISTOGRAM_BOUNDS = [10, 25, 50, 100, 250, 500, 1000, 5000];

const metrics = new Map<string, MetricEntry>();
let totalRequests = 0;
let totalErrors = 0;
let activeRequests = 0;
let startTime = Date.now();

function getMetric(method: string, path: string, status: string): MetricEntry {
	const key = `${method}|${path}|${status}`;
	let entry = metrics.get(key);
	if (!entry) {
		entry = { count: 0, totalDuration: 0, buckets: new Array(HISTOGRAM_BOUNDS.length).fill(0) };
		metrics.set(key, entry);
	}
	return entry;
}

function normalizePath(path: string): string {
	// Replace Ethereum addresses with :address placeholder
	return path.replace(/0x[a-fA-F0-9]{40}/g, ":address")
		// Replace UUIDs
		.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id");
}

/**
 * Metrics collection middleware — records latency and counts per route.
 */
export function metricsCollector() {
	return async (c: Context, next: Next) => {
		activeRequests++;
		totalRequests++;
		const start = Date.now();

		try {
			await next();
		} finally {
			activeRequests--;
			const duration = Date.now() - start;
			const statusGroup = `${Math.floor(c.res.status / 100)}xx`;
			const normalPath = normalizePath(c.req.path);
			const entry = getMetric(c.req.method, normalPath, statusGroup);

			entry.count++;
			entry.totalDuration += duration;

			// Fill histogram buckets
			for (let i = 0; i < HISTOGRAM_BOUNDS.length; i++) {
				if (duration <= HISTOGRAM_BOUNDS[i]!) {
					entry.buckets[i]!++;
				}
			}

			if (c.res.status >= 400) totalErrors++;
		}
	};
}

/**
 * Render metrics in Prometheus text exposition format.
 */
function renderPrometheus(): string {
	const lines: string[] = [];

	// Process uptime
	lines.push("# HELP qova_process_uptime_seconds Process uptime in seconds");
	lines.push("# TYPE qova_process_uptime_seconds gauge");
	lines.push(`qova_process_uptime_seconds ${((Date.now() - startTime) / 1000).toFixed(1)}`);

	// Active requests
	lines.push("# HELP qova_active_requests Current number of in-flight requests");
	lines.push("# TYPE qova_active_requests gauge");
	lines.push(`qova_active_requests ${activeRequests}`);

	// Total requests
	lines.push("# HELP qova_http_requests_total Total HTTP requests");
	lines.push("# TYPE qova_http_requests_total counter");
	lines.push(`qova_http_requests_total ${totalRequests}`);

	// Total errors
	lines.push("# HELP qova_http_errors_total Total HTTP error responses (4xx + 5xx)");
	lines.push("# TYPE qova_http_errors_total counter");
	lines.push(`qova_http_errors_total ${totalErrors}`);

	// Per-route metrics
	lines.push("# HELP qova_http_request_duration_ms Request duration histogram");
	lines.push("# TYPE qova_http_request_duration_ms histogram");

	for (const [key, entry] of metrics) {
		const [method, path, status] = key.split("|");
		const labels = `method="${method}",path="${path}",status="${status}"`;

		lines.push(`qova_http_request_count{${labels}} ${entry.count}`);

		const avgMs = entry.count > 0 ? (entry.totalDuration / entry.count).toFixed(1) : "0";
		lines.push(`qova_http_request_duration_avg_ms{${labels}} ${avgMs}`);

		let cumulative = 0;
		for (let i = 0; i < HISTOGRAM_BOUNDS.length; i++) {
			cumulative += entry.buckets[i]!;
			lines.push(`qova_http_request_duration_ms_bucket{${labels},le="${HISTOGRAM_BOUNDS[i]}"} ${cumulative}`);
		}
		lines.push(`qova_http_request_duration_ms_bucket{${labels},le="+Inf"} ${entry.count}`);
		lines.push(`qova_http_request_duration_ms_sum{${labels}} ${entry.totalDuration}`);
		lines.push(`qova_http_request_duration_ms_count{${labels}} ${entry.count}`);
	}

	// Circuit breaker states
	const circuitStates = getAllCircuitStates();
	if (Object.keys(circuitStates).length > 0) {
		lines.push("# HELP qova_circuit_breaker_state Circuit breaker state (0=closed, 1=half_open, 2=open)");
		lines.push("# TYPE qova_circuit_breaker_state gauge");
		const stateMap: Record<string, number> = { CLOSED: 0, HALF_OPEN: 1, OPEN: 2 };
		for (const [name, state] of Object.entries(circuitStates)) {
			lines.push(`qova_circuit_breaker_state{name="${name}"} ${stateMap[state] ?? 0}`);
		}
	}

	return lines.join("\n") + "\n";
}

/**
 * Metrics route — serves Prometheus text format at GET /api/metrics.
 */
export const metricsRoutes = new Hono();

metricsRoutes.get("/", (c) => {
	return c.text(renderPrometheus(), 200, {
		"Content-Type": "text/plain; version=0.0.4; charset=utf-8",
	});
});

/** Reset metrics (for testing). */
export function resetMetrics(): void {
	metrics.clear();
	totalRequests = 0;
	totalErrors = 0;
	activeRequests = 0;
	startTime = Date.now();
}
