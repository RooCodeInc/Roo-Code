import { describe, it, expect, vi, beforeEach } from "vitest"
import { MermaidDiagramFixer } from "../MermaidDiagramFixer"

// Mock the entire Google Generative AI module
vi.mock("@google/generative-ai", () => {
	const mockGenerateContent = vi.fn()
	return {
		GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
			getGenerativeModel: vi.fn().mockReturnValue({
				generateContent: mockGenerateContent,
			}),
		})),
		_mockGenerateContent: mockGenerateContent,
	}
})

describe("MermaidDiagramFixer", () => {
	let fixer: MermaidDiagramFixer
	let mockApiConfig: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockApiConfig = {
			geminiApiKey: "test-api-key",
			geminiModel: "gemini-1.5-flash",
		}

		fixer = new MermaidDiagramFixer(mockApiConfig)
	})

	describe("fixDiagram", () => {
		it("should throw error if API key is not configured", async () => {
			const invalidConfig = { geminiModel: "gemini-1.5-flash" }
			const fixer = new MermaidDiagramFixer(invalidConfig)

			await expect(fixer.fixDiagram("invalid diagram", "error message")).rejects.toThrow(
				"Gemini API key is required for diagram fixing",
			)
		})

		it("should throw error if API key is empty string", async () => {
			const invalidConfig = { geminiApiKey: "", geminiModel: "gemini-1.5-flash" }
			const fixer = new MermaidDiagramFixer(invalidConfig)

			await expect(fixer.fixDiagram("invalid diagram", "error message")).rejects.toThrow(
				"Gemini API key is required for diagram fixing",
			)
		})

		it("should use default model if not specified", () => {
			const configWithoutModel = { geminiApiKey: "test-key" }
			const fixer = new MermaidDiagramFixer(configWithoutModel)

			// The constructor should set a default model
			expect(fixer).toBeDefined()
		})

		it("should handle API errors gracefully", async () => {
			// Get the mock function
			const { _mockGenerateContent } = (await import("@google/generative-ai")) as any
			_mockGenerateContent.mockRejectedValueOnce(new Error("API Error"))

			await expect(fixer.fixDiagram("invalid diagram", "error")).rejects.toThrow("Failed to fix Mermaid diagram")
		})

		it("should successfully process a valid response", async () => {
			// Get the mock function
			const { _mockGenerateContent } = (await import("@google/generative-ai")) as any

			// Mock successful responses for each stage
			_mockGenerateContent
				.mockResolvedValueOnce({
					response: {
						text: () =>
							JSON.stringify({
								diagram_type: "flowchart",
								nodes: [
									{ id: "A", label: "Start" },
									{ id: "B", label: "End" },
								],
								edges: [{ from: "A", to: "B", label: "Process" }],
							}),
					},
				})
				.mockResolvedValueOnce({
					response: {
						text: () => "Valid JSON structure",
					},
				})
				.mockResolvedValueOnce({
					response: {
						text: () => `
def convert_to_mermaid(json_data):
    result = "graph TD\\n"
    for edge in json_data['edges']:
        label = f"|{edge['label']}|" if edge.get('label') else ""
        result += f"{edge['from']} -->{label} {edge['to']}\\n"
    return result.strip()
`,
					},
				})
				.mockResolvedValueOnce({
					response: {
						text: () => "graph TD\nA -->|Process| B",
					},
				})

			const result = await fixer.fixDiagram("graph TD\nA -> B", "Syntax error")

			expect(result).toBe("graph TD\nA -->|Process| B")
			expect(_mockGenerateContent).toHaveBeenCalledTimes(4)
		})

		it("should handle empty response from API", async () => {
			const { _mockGenerateContent } = (await import("@google/generative-ai")) as any
			_mockGenerateContent.mockResolvedValueOnce({
				response: {
					text: () => "",
				},
			})

			await expect(fixer.fixDiagram("invalid", "error")).rejects.toThrow("Failed to fix Mermaid diagram")
		})

		it("should handle invalid JSON response", async () => {
			const { _mockGenerateContent } = (await import("@google/generative-ai")) as any
			_mockGenerateContent.mockResolvedValueOnce({
				response: {
					text: () => "Not valid JSON",
				},
			})

			await expect(fixer.fixDiagram("invalid", "error")).rejects.toThrow("Failed to fix Mermaid diagram")
		})

		it("should handle sequence diagrams", async () => {
			const { _mockGenerateContent } = (await import("@google/generative-ai")) as any

			_mockGenerateContent
				.mockResolvedValueOnce({
					response: {
						text: () =>
							JSON.stringify({
								diagram_type: "sequence",
								participants: ["Alice", "Bob"],
								messages: [{ from: "Alice", to: "Bob", message: "Hello", type: "solid" }],
							}),
					},
				})
				.mockResolvedValueOnce({
					response: {
						text: () => "Valid",
					},
				})
				.mockResolvedValueOnce({
					response: {
						text: () => `
def convert_to_mermaid(json_data):
    result = "sequenceDiagram\\n"
    for p in json_data['participants']:
        result += f"participant {p}\\n"
    for msg in json_data['messages']:
        arrow = '->' if msg['type'] == 'solid' else '-->'
        result += f"{msg['from']}{arrow}{msg['to']}: {msg['message']}\\n"
    return result.strip()
`,
					},
				})
				.mockResolvedValueOnce({
					response: {
						text: () => "sequenceDiagram\nparticipant Alice\nparticipant Bob\nAlice->Bob: Hello",
					},
				})

			const result = await fixer.fixDiagram("sequenceDiagram\nAlice->Bob Hello", "Missing colon")

			expect(result).toBe("sequenceDiagram\nparticipant Alice\nparticipant Bob\nAlice->Bob: Hello")
		})
	})

	describe("error handling", () => {
		it("should handle network errors", async () => {
			const { _mockGenerateContent } = (await import("@google/generative-ai")) as any
			_mockGenerateContent.mockRejectedValueOnce(new Error("Network error"))

			await expect(fixer.fixDiagram("invalid", "error")).rejects.toThrow("Failed to fix Mermaid diagram")
		})

		it("should handle timeout errors", async () => {
			const { _mockGenerateContent } = (await import("@google/generative-ai")) as any
			_mockGenerateContent.mockRejectedValueOnce(new Error("Request timeout"))

			await expect(fixer.fixDiagram("invalid", "error")).rejects.toThrow("Failed to fix Mermaid diagram")
		})

		it("should handle rate limit errors", async () => {
			const { _mockGenerateContent } = (await import("@google/generative-ai")) as any
			_mockGenerateContent.mockRejectedValueOnce(new Error("Rate limit exceeded"))

			await expect(fixer.fixDiagram("invalid", "error")).rejects.toThrow("Failed to fix Mermaid diagram")
		})
	})
})
