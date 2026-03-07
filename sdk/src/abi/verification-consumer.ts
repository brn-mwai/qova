/**
 * ABI for the QovaVerificationConsumer contract.
 *
 * Receives World ID verification results from CRE workflows and stores
 * verified agent status on-chain with sybil resistance via nullifier tracking.
 * Extracted from Foundry build output (out/QovaVerificationConsumer.sol/QovaVerificationConsumer.json).
 *
 * @see contracts/src/QovaVerificationConsumer.sol
 */
export const verificationConsumerAbi = [
	{
		type: "constructor",
		inputs: [
			{
				name: "_forwarder",
				type: "address",
				internalType: "address",
			},
		],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "getVerification",
		inputs: [
			{
				name: "agent",
				type: "address",
				internalType: "address",
			},
		],
		outputs: [
			{
				name: "",
				type: "tuple",
				internalType: "struct QovaVerificationConsumer.Verification",
				components: [
					{
						name: "agent",
						type: "address",
						internalType: "address",
					},
					{
						name: "nullifierHash",
						type: "uint256",
						internalType: "uint256",
					},
					{
						name: "verificationLevel",
						type: "uint8",
						internalType: "uint8",
					},
					{
						name: "timestamp",
						type: "uint48",
						internalType: "uint48",
					},
					{
						name: "verified",
						type: "bool",
						internalType: "bool",
					},
				],
			},
		],
		stateMutability: "view",
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
		name: "isNullifierUsed",
		inputs: [
			{
				name: "nullifierHash",
				type: "uint256",
				internalType: "uint256",
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
		name: "isVerified",
		inputs: [
			{
				name: "agent",
				type: "address",
				internalType: "address",
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
		name: "revokeVerification",
		inputs: [
			{
				name: "agent",
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
		type: "function",
		name: "usedNullifiers",
		inputs: [
			{
				name: "",
				type: "uint256",
				internalType: "uint256",
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
		name: "verifications",
		inputs: [
			{
				name: "",
				type: "address",
				internalType: "address",
			},
		],
		outputs: [
			{
				name: "agent",
				type: "address",
				internalType: "address",
			},
			{
				name: "nullifierHash",
				type: "uint256",
				internalType: "uint256",
			},
			{
				name: "verificationLevel",
				type: "uint8",
				internalType: "uint8",
			},
			{
				name: "timestamp",
				type: "uint48",
				internalType: "uint48",
			},
			{
				name: "verified",
				type: "bool",
				internalType: "bool",
			},
		],
		stateMutability: "view",
	},
	{
		type: "event",
		name: "AgentVerified",
		inputs: [
			{
				name: "agent",
				type: "address",
				indexed: true,
				internalType: "address",
			},
			{
				name: "nullifierHash",
				type: "uint256",
				indexed: true,
				internalType: "uint256",
			},
			{
				name: "verificationLevel",
				type: "uint8",
				indexed: false,
				internalType: "uint8",
			},
			{
				name: "timestamp",
				type: "uint48",
				indexed: false,
				internalType: "uint48",
			},
		],
		anonymous: false,
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
		name: "VerificationRevoked",
		inputs: [
			{
				name: "agent",
				type: "address",
				indexed: true,
				internalType: "address",
			},
			{
				name: "nullifierHash",
				type: "uint256",
				indexed: true,
				internalType: "uint256",
			},
		],
		anonymous: false,
	},
	{
		type: "error",
		name: "InvalidVerificationLevel",
		inputs: [],
	},
	{
		type: "error",
		name: "NullifierAlreadyUsed",
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
		name: "UnauthorizedForwarder",
		inputs: [],
	},
] as const;
