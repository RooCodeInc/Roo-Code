import { parseAzureUrl } from "../parseAzureUrl"

describe("parseAzureUrl", () => {
	it("parses a full openai.azure.com URL with api-version", () => {
		const result = parseAzureUrl(
			"https://my-resource.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-10-21",
		)
		expect(result).toEqual({
			baseUrl: "https://my-resource.openai.azure.com/openai",
			deploymentName: "gpt-4o",
			apiVersion: "2024-10-21",
		})
	})

	it("parses a cognitiveservices.azure.com URL", () => {
		const result = parseAzureUrl(
			"https://my-deployment.cognitiveservices.azure.com/openai/deployments/gpt-5.2/chat/completions?api-version=2024-05-01-preview",
		)
		expect(result).toEqual({
			baseUrl: "https://my-deployment.cognitiveservices.azure.com/openai",
			deploymentName: "gpt-5.2",
			apiVersion: "2024-05-01-preview",
		})
	})

	it("parses a services.ai.azure.com URL", () => {
		const result = parseAzureUrl(
			"https://my-resource.services.ai.azure.com/openai/deployments/my-model/responses?api-version=2025-01-01",
		)
		expect(result).toEqual({
			baseUrl: "https://my-resource.services.ai.azure.com/openai",
			deploymentName: "my-model",
			apiVersion: "2025-01-01",
		})
	})

	it("handles URL without api-version query param", () => {
		const result = parseAzureUrl("https://my-resource.openai.azure.com/openai/deployments/gpt-4o/chat/completions")
		expect(result).toEqual({
			baseUrl: "https://my-resource.openai.azure.com/openai",
			deploymentName: "gpt-4o",
		})
	})

	it("handles URL with trailing slash", () => {
		const result = parseAzureUrl("https://my-resource.openai.azure.com/openai/deployments/gpt-4o/chat/completions/")
		expect(result).toEqual({
			baseUrl: "https://my-resource.openai.azure.com/openai",
			deploymentName: "gpt-4o",
		})
	})

	it("handles deployment name with dots", () => {
		const result = parseAzureUrl(
			"https://my-resource.openai.azure.com/openai/deployments/gpt-4.turbo.2024/chat/completions?api-version=2024-10-21",
		)
		expect(result).toEqual({
			baseUrl: "https://my-resource.openai.azure.com/openai",
			deploymentName: "gpt-4.turbo.2024",
			apiVersion: "2024-10-21",
		})
	})

	it("handles URL with only /openai/deployments/{name} (no trailing path)", () => {
		const result = parseAzureUrl(
			"https://my-resource.openai.azure.com/openai/deployments/my-deploy?api-version=2024-10-21",
		)
		expect(result).toEqual({
			baseUrl: "https://my-resource.openai.azure.com/openai",
			deploymentName: "my-deploy",
			apiVersion: "2024-10-21",
		})
	})

	it("returns null for a plain base URL (no /deployments/ path)", () => {
		const result = parseAzureUrl("https://my-resource.openai.azure.com/openai")
		expect(result).toBeNull()
	})

	it("returns null for a non-URL string", () => {
		const result = parseAzureUrl("not-a-url")
		expect(result).toBeNull()
	})

	it("returns null for an empty string", () => {
		const result = parseAzureUrl("")
		expect(result).toBeNull()
	})

	it("returns null for a URL without /openai/ prefix", () => {
		const result = parseAzureUrl("https://my-resource.openai.azure.com/deployments/gpt-4o/chat/completions")
		expect(result).toBeNull()
	})

	it("handles encoded deployment names", () => {
		const result = parseAzureUrl(
			"https://my-resource.openai.azure.com/openai/deployments/my%20deploy/chat/completions",
		)
		expect(result).toEqual({
			baseUrl: "https://my-resource.openai.azure.com/openai",
			deploymentName: "my deploy",
		})
	})

	it("handles additional query parameters besides api-version", () => {
		const result = parseAzureUrl(
			"https://my-resource.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-10-21&extra=param",
		)
		expect(result).toEqual({
			baseUrl: "https://my-resource.openai.azure.com/openai",
			deploymentName: "gpt-4o",
			apiVersion: "2024-10-21",
		})
	})
})
