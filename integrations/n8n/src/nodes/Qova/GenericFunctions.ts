/**
 * Shared HTTP helpers for Qova n8n nodes.
 * @author Qova Engineering <eng@qova.cc>
 */

import type {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IPollFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	IDataObject,
} from "n8n-workflow";
import { NodeApiError } from "n8n-workflow";

/**
 * Makes an authenticated HTTP request to the Qova API.
 *
 * Handles credential resolution, base URL construction, error wrapping,
 * and returns the parsed JSON response body.
 */
export async function qovaApiRequest(
	this: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions | IPollFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	query?: IDataObject,
): Promise<IDataObject> {
	const credentials = await this.getCredentials("qovaApi");
	const baseUrl = (credentials.baseUrl as string) || "https://api.qova.cc";

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl.replace(/\/$/, "")}${endpoint}`,
		headers: {
			"Content-Type": "application/json",
			"x-api-key": credentials.apiKey as string,
		},
		json: true,
	};

	if (body && Object.keys(body).length > 0) {
		options.body = body;
	}

	if (query && Object.keys(query).length > 0) {
		options.qs = query;
	}

	try {
		const response = await this.helpers.httpRequest(options);
		return response as IDataObject;
	} catch (error: unknown) {
		const errorData = error instanceof Error
			? { message: error.message }
			: { message: String(error) };
		throw new NodeApiError(this.getNode(), errorData, {
			message: "Qova API request failed",
			description: `${method} ${endpoint} returned an error`,
		});
	}
}

/**
 * Validates that a string looks like a valid Ethereum address (0x + 40 hex chars).
 */
export function isValidAddress(address: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(address);
}
