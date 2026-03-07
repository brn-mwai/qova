/**
 * ABI for the QovaReputationConsumer contract.
 *
 * Receives CRE workflow reports via KeystoneForwarder and writes
 * reputation scores to the ReputationRegistry.
 * Extracted from Foundry build output (out/QovaReputationConsumer.sol/QovaReputationConsumer.json).
 *
 * @see contracts/src/QovaReputationConsumer.sol
 */
export const reputationConsumerAbi = [
	{
		type: "constructor",
		inputs: [
			{
				name: "_forwarder",
				type: "address",
				internalType: "address",
			},
			{
				name: "_registry",
				type: "address",
				internalType: "address",
			},
		],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "i_forwarder",
		inputs: [],
		outputs: [
			{
				name: "",
				type: "address",
				internalType: "address",
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "lastReportTimestamp",
		inputs: [
			{
				name: "",
				type: "address",
				internalType: "address",
			},
		],
		outputs: [
			{
				name: "",
				type: "uint256",
				internalType: "uint256",
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "onReport",
		inputs: [
			{
				name: "metadata",
				type: "bytes",
				internalType: "bytes",
			},
			{
				name: "report",
				type: "bytes",
				internalType: "bytes",
			},
		],
		outputs: [],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "owner",
		inputs: [],
		outputs: [
			{
				name: "",
				type: "address",
				internalType: "address",
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "processedReports",
		inputs: [
			{
				name: "",
				type: "bytes32",
				internalType: "bytes32",
			},
		],
		outputs: [
			{
				name: "",
				type: "bool",
				internalType: "bool",
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "renounceOwnership",
		inputs: [],
		outputs: [],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "reputationRegistry",
		inputs: [],
		outputs: [
			{
				name: "",
				type: "address",
				internalType: "contract ReputationRegistry",
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "setReputationRegistry",
		inputs: [
			{
				name: "_registry",
				type: "address",
				internalType: "address",
			},
		],
		outputs: [],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "transferOwnership",
		inputs: [
			{
				name: "newOwner",
				type: "address",
				internalType: "address",
			},
		],
		outputs: [],
		stateMutability: "nonpayable",
	},
	{
		type: "event",
		name: "OwnershipTransferred",
		inputs: [
			{
				name: "previousOwner",
				type: "address",
				indexed: true,
				internalType: "address",
			},
			{
				name: "newOwner",
				type: "address",
				indexed: true,
				internalType: "address",
			},
		],
		anonymous: false,
	},
	{
		type: "event",
		name: "RegistryUpdated",
		inputs: [
			{
				name: "oldRegistry",
				type: "address",
				indexed: true,
				internalType: "address",
			},
			{
				name: "newRegistry",
				type: "address",
				indexed: true,
				internalType: "address",
			},
		],
		anonymous: false,
	},
	{
		type: "event",
		name: "ReputationReportProcessed",
		inputs: [
			{
				name: "agent",
				type: "address",
				indexed: true,
				internalType: "address",
			},
			{
				name: "newScore",
				type: "uint16",
				indexed: false,
				internalType: "uint16",
			},
			{
				name: "timestamp",
				type: "uint256",
				indexed: false,
				internalType: "uint256",
			},
		],
		anonymous: false,
	},
	{
		type: "error",
		name: "InvalidRegistry",
		inputs: [],
	},
	{
		type: "error",
		name: "OwnableInvalidOwner",
		inputs: [
			{
				name: "owner",
				type: "address",
				internalType: "address",
			},
		],
	},
	{
		type: "error",
		name: "OwnableUnauthorizedAccount",
		inputs: [
			{
				name: "account",
				type: "address",
				internalType: "address",
			},
		],
	},
	{
		type: "error",
		name: "ReportAlreadyProcessed",
		inputs: [],
	},
	{
		type: "error",
		name: "ScoreOutOfRange",
		inputs: [],
	},
	{
		type: "error",
		name: "StaleReport",
		inputs: [],
	},
	{
		type: "error",
		name: "UnauthorizedForwarder",
		inputs: [],
	},
] as const;
