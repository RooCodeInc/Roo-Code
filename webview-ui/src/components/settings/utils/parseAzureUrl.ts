export interface ParsedAzureUrl {
	/** e.g. "https://my-resource.cognitiveservices.azure.com/openai" */
	baseUrl: string
	/** e.g. "gpt-5.2" */
	deploymentName: string
	/** e.g. "2024-05-01-preview" */
	apiVersion?: string
}

/**
 * Parses a full Azure OpenAI URL into its components.
 * Returns null if the URL doesn't match the expected pattern.
 *
 * Supported URL formats:
 * - https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={ver}
 * - https://{resource}.cognitiveservices.azure.com/openai/deployments/{deployment}/responses?api-version={ver}
 * - https://{resource}.services.ai.azure.com/openai/deployments/{deployment}/{anything}?api-version={ver}
 */
export function parseAzureUrl(input: string): ParsedAzureUrl | null {
	let url: URL
	try {
		url = new URL(input)
	} catch {
		return null
	}

	// Match pathname: /openai/deployments/{name}/...
	const match = url.pathname.match(/^(\/openai)\/deployments\/([^/]+)/)
	if (!match) {
		return null
	}

	const baseUrl = `${url.origin}${match[1]}`
	const deploymentName = decodeURIComponent(match[2])
	const apiVersion = url.searchParams.get("api-version") ?? undefined

	return { baseUrl, deploymentName, ...(apiVersion !== undefined && { apiVersion }) }
}
