/**
 * Circuit breaker — prevents cascading failures when upstream services (chain RPC, Convex) are down.
 *
 * States:
 * - CLOSED: normal operation, requests pass through
 * - OPEN: too many failures, requests fail fast with 503
 * - HALF_OPEN: after cooldown, one probe request allowed through
 *
 * @author Qova Engineering <eng@qova.cc>
 */

import type { Context, Next } from "hono";
import { problemResponse } from "./problem.js";

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitConfig {
	/** Number of failures before opening the circuit. Default: 5. */
	failureThreshold?: number;
	/** Time in ms to wait before transitioning from OPEN to HALF_OPEN. Default: 30_000. */
	cooldownMs?: number;
	/** Time window in ms to count failures. Default: 60_000. */
	windowMs?: number;
	/** Name for logging. */
	name?: string;
}

interface CircuitBreakerState {
	state: CircuitState;
	failures: number[];
	lastFailure: number;
	openedAt: number;
}

const circuits = new Map<string, CircuitBreakerState>();

function getCircuit(name: string): CircuitBreakerState {
	let circuit = circuits.get(name);
	if (!circuit) {
		circuit = { state: "CLOSED", failures: [], lastFailure: 0, openedAt: 0 };
		circuits.set(name, circuit);
	}
	return circuit;
}

function pruneFailures(circuit: CircuitBreakerState, windowMs: number): void {
	const cutoff = Date.now() - windowMs;
	circuit.failures = circuit.failures.filter((t) => t > cutoff);
}

/**
 * Record a failure on the named circuit.
 */
export function recordFailure(name: string, config: CircuitConfig = {}): void {
	const threshold = config.failureThreshold ?? 5;
	const windowMs = config.windowMs ?? 60_000;
	const circuit = getCircuit(name);

	circuit.failures.push(Date.now());
	circuit.lastFailure = Date.now();
	pruneFailures(circuit, windowMs);

	if (circuit.failures.length >= threshold) {
		circuit.state = "OPEN";
		circuit.openedAt = Date.now();
	}
}

/**
 * Record a success on the named circuit.
 */
export function recordSuccess(name: string): void {
	const circuit = getCircuit(name);
	if (circuit.state === "HALF_OPEN") {
		circuit.state = "CLOSED";
		circuit.failures = [];
	}
}

/**
 * Get current state of a circuit (for health checks / metrics).
 */
export function getCircuitState(name: string): CircuitState {
	return getCircuit(name).state;
}

/**
 * Middleware that fails fast when a circuit is open.
 */
export function circuitBreaker(config: CircuitConfig = {}) {
	const name = config.name ?? "default";
	const cooldownMs = config.cooldownMs ?? 30_000;

	return async (c: Context, next: Next) => {
		const circuit = getCircuit(name);

		if (circuit.state === "OPEN") {
			// Check if cooldown has passed
			if (Date.now() - circuit.openedAt > cooldownMs) {
				circuit.state = "HALF_OPEN";
				// Allow this one request as a probe
			} else {
				return problemResponse(c, 503, "SERVICE_UNAVAILABLE", "Service Temporarily Unavailable",
					`The ${name} service is currently experiencing issues. Please retry after ${Math.ceil((cooldownMs - (Date.now() - circuit.openedAt)) / 1000)}s.`);
			}
		}

		try {
			await next();

			// If the response is a server error, record failure
			if (c.res.status >= 500) {
				recordFailure(name, config);
			} else {
				recordSuccess(name);
			}
		} catch (error) {
			recordFailure(name, config);
			throw error;
		}
	};
}

/** Reset all circuits (for testing). */
export function resetCircuits(): void {
	circuits.clear();
}

/** Get all circuit states (for health/metrics). */
export function getAllCircuitStates(): Record<string, CircuitState> {
	const states: Record<string, CircuitState> = {};
	for (const [name, circuit] of circuits) {
		states[name] = circuit.state;
	}
	return states;
}
