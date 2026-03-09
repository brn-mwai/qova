import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from "n8n-workflow";

export class QovaApi implements ICredentialType {
	name = "qovaApi";
	displayName = "Qova API";
	documentationUrl = "https://docs.qova.cc";

	properties: INodeProperties[] = [
		{
			displayName: "API Key",
			name: "apiKey",
			type: "string",
			typeOptions: { password: true },
			default: "",
			required: true,
			description: "Your Qova API key. Find it in your Qova dashboard at app.qova.cc.",
		},
		{
			displayName: "Base URL",
			name: "baseUrl",
			type: "string",
			default: "https://api.qova.cc",
			required: true,
			description:
				"Base URL for the Qova API. Default: https://api.qova.cc. Only change for self-hosted instances.",
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: "generic",
		properties: {
			headers: {
				"x-api-key": "={{$credentials.apiKey}}",
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: "={{$credentials.baseUrl}}",
			url: "/api/health",
			method: "GET",
		},
	};
}
