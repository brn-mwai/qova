/**
 * Core types for the Qova protocol.
 * @author Qova Engineering <eng@qova.cc>
 */

import { z } from "zod";

// Result pattern for expected errors
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
	return { ok: false, error };
}

// Zod schemas
export const AgentIdentitySchema = z.object({
	agentId: z.string().min(1),
	owner: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
	name: z.string().min(1).max(64),
	metadata: z.record(z.unknown()).optional(),
	createdAt: z.number(),
});

export const ReputationScoreSchema = z.object({
	agentId: z.string(),
	score: z.number().min(0).max(1000),
	confidence: z.number().min(0).max(100),
	totalTransactions: z.number().int().min(0),
	successRate: z.number().min(0).max(100),
	lastUpdated: z.number(),
});

export const TransactionRecordSchema = z.object({
	txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
	from: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
	to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
	amount: z.string(),
	token: z.string(),
	timestamp: z.number(),
	status: z.enum(["pending", "completed", "failed", "disputed"]),
});

// Inferred types
export type AgentIdentity = z.infer<typeof AgentIdentitySchema>;
export type ReputationScore = z.infer<typeof ReputationScoreSchema>;
export type TransactionRecord = z.infer<typeof TransactionRecordSchema>;

