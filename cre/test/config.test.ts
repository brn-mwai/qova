import { describe, expect, it } from "bun:test";
import {
	AgentVerifyConfigSchema,
	BudgetAlertConfigSchema,
	ReputationOracleConfigSchema,
	TransactionMonitorConfigSchema,
} from "../shared/types";

describe("Config validation", () => {
	describe("ReputationOracleConfig", () => {
		it("accepts valid config", () => {
			const result = ReputationOracleConfigSchema.safeParse({
				schedule: "0 */5 * * * *",
				evm: {
					chainSelectorName: "ethereum-testnet-sepolia-base-1",
					reputationRegistry: "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB",
					transactionValidator: "0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900",
					budgetEnforcer: "0x271618781040dc358e4F6B66561b65A839b0C76E",
				},
				scoringApiUrl: "http://localhost:3001/v1",
			});
			expect(result.success).toBe(true);
		});

		it("rejects missing schedule", () => {
			const result = ReputationOracleConfigSchema.safeParse({
				evm: {
					chainSelectorName: "ethereum-testnet-sepolia-base-1",
					reputationRegistry: "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB",
					transactionValidator: "0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900",
					budgetEnforcer: "0x271618781040dc358e4F6B66561b65A839b0C76E",
				},
				scoringApiUrl: "http://localhost:3001/v1",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("TransactionMonitorConfig", () => {
		it("accepts valid config with all fields", () => {
			const result = TransactionMonitorConfigSchema.safeParse({
				evm: {
					chainSelectorName: "ethereum-testnet-sepolia-base-1",
					transactionValidator: "0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900",
					reputationRegistry: "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB",
					qovaCore: "0x9Ee4ae0bD93E95498fB6AB444ae6205d56fEf76a",
				},
				scoringApiUrl: "http://localhost:3001/v1",
				rpcUrl: "https://sepolia.base.org",
			});
			expect(result.success).toBe(true);
		});

		it("accepts config with optional webhook", () => {
			const result = TransactionMonitorConfigSchema.safeParse({
				evm: {
					chainSelectorName: "ethereum-testnet-sepolia-base-1",
					transactionValidator: "0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900",
					reputationRegistry: "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB",
					qovaCore: "0x9Ee4ae0bD93E95498fB6AB444ae6205d56fEf76a",
				},
				scoringApiUrl: "http://localhost:3001/v1",
				alertWebhookUrl: "http://localhost:3001/v1/webhook",
				rpcUrl: "https://sepolia.base.org",
			});
			expect(result.success).toBe(true);
		});

		it("rejects missing rpcUrl", () => {
			const result = TransactionMonitorConfigSchema.safeParse({
				evm: {
					chainSelectorName: "ethereum-testnet-sepolia-base-1",
					transactionValidator: "0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900",
					reputationRegistry: "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB",
					qovaCore: "0x9Ee4ae0bD93E95498fB6AB444ae6205d56fEf76a",
				},
				scoringApiUrl: "http://localhost:3001/v1",
			});
			expect(result.success).toBe(false);
		});

		it("rejects missing qovaCore", () => {
			const result = TransactionMonitorConfigSchema.safeParse({
				evm: {
					chainSelectorName: "ethereum-testnet-sepolia-base-1",
					transactionValidator: "0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900",
					reputationRegistry: "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB",
				},
				scoringApiUrl: "http://localhost:3001/v1",
				rpcUrl: "https://sepolia.base.org",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("BudgetAlertConfig", () => {
		it("accepts valid config", () => {
			const result = BudgetAlertConfigSchema.safeParse({
				evm: {
					chainSelectorName: "ethereum-testnet-sepolia-base-1",
					budgetEnforcer: "0x271618781040dc358e4F6B66561b65A839b0C76E",
					reputationRegistry: "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB",
					qovaCore: "0x9Ee4ae0bD93E95498fB6AB444ae6205d56fEf76a",
				},
				alertWebhookUrl: "http://localhost:3001/v1/webhook",
				scoringApiUrl: "http://localhost:3001/v1",
			});
			expect(result.success).toBe(true);
		});

		it("rejects missing webhook (required for budget alerts)", () => {
			const result = BudgetAlertConfigSchema.safeParse({
				evm: {
					chainSelectorName: "ethereum-testnet-sepolia-base-1",
					budgetEnforcer: "0x271618781040dc358e4F6B66561b65A839b0C76E",
					reputationRegistry: "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB",
					qovaCore: "0x9Ee4ae0bD93E95498fB6AB444ae6205d56fEf76a",
				},
				scoringApiUrl: "http://localhost:3001/v1",
			});
			expect(result.success).toBe(false);
		});

		it("rejects missing reputationRegistry", () => {
			const result = BudgetAlertConfigSchema.safeParse({
				evm: {
					chainSelectorName: "ethereum-testnet-sepolia-base-1",
					budgetEnforcer: "0x271618781040dc358e4F6B66561b65A839b0C76E",
				},
				alertWebhookUrl: "http://localhost:3001/v1/webhook",
				scoringApiUrl: "http://localhost:3001/v1",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("AgentVerifyConfig", () => {
		it("accepts valid config", () => {
			const result = AgentVerifyConfigSchema.safeParse({
				evm: {
					chainSelectorName: "ethereum-testnet-sepolia-base-1",
					reputationRegistry: "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB",
					transactionValidator: "0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900",
					budgetEnforcer: "0x271618781040dc358e4F6B66561b65A839b0C76E",
					qovaCore: "0x9Ee4ae0bD93E95498fB6AB444ae6205d56fEf76a",
				},
				sanctionsApiUrl: "http://localhost:3001/v1/sanctions",
				rpcUrl: "https://sepolia.base.org",
			});
			expect(result.success).toBe(true);
		});

		it("rejects missing rpcUrl", () => {
			const result = AgentVerifyConfigSchema.safeParse({
				evm: {
					chainSelectorName: "ethereum-testnet-sepolia-base-1",
					reputationRegistry: "0x0b2466b01E6d73A24D9C716A9072ED3923563fBB",
					transactionValidator: "0x5d7a7AEAb26D2F0076892D1C9A28F230EbB3e900",
					budgetEnforcer: "0x271618781040dc358e4F6B66561b65A839b0C76E",
					qovaCore: "0x9Ee4ae0bD93E95498fB6AB444ae6205d56fEf76a",
				},
				sanctionsApiUrl: "http://localhost:3001/v1/sanctions",
			});
			expect(result.success).toBe(false);
		});
	});
});
