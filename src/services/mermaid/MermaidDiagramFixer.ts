import { GoogleGenAI } from "@google/genai"
import { safeJsonParse } from "../../shared/safeJsonParse"
import { t } from "../../i18n"
import * as vscode from "vscode"

// JSON Schema for structured Mermaid diagram representation
const MERMAID_JSON_SCHEMA = {
	type: "object",
	properties: {
		diagramType: {
			type: "string",
			enum: ["flowchart", "sequence", "class", "state", "er", "gantt", "pie", "journey", "gitGraph", "mindmap"],
		},
		title: { type: "string" },
		nodes: {
			type: "array",
			items: {
				type: "object",
				properties: {
					id: { type: "string" },
					label: { type: "string" },
					shape: { type: "string" },
					style: { type: "string" },
				},
				required: ["id", "label"],
			},
		},
		edges: {
			type: "array",
			items: {
				type: "object",
				properties: {
					from: { type: "string" },
					to: { type: "string" },
					label: { type: "string" },
					type: { type: "string" },
				},
				required: ["from", "to"],
			},
		},
		participants: {
			type: "array",
			items: { type: "string" },
		},
		messages: {
			type: "array",
			items: {
				type: "object",
				properties: {
					from: { type: "string" },
					to: { type: "string" },
					message: { type: "string" },
					type: { type: "string" },
				},
			},
		},
		classes: {
			type: "array",
			items: {
				type: "object",
				properties: {
					name: { type: "string" },
					attributes: { type: "array", items: { type: "string" } },
					methods: { type: "array", items: { type: "string" } },
				},
			},
		},
		relationships: {
			type: "array",
			items: {
				type: "object",
				properties: {
					from: { type: "string" },
					to: { type: "string" },
					type: { type: "string" },
					label: { type: "string" },
				},
			},
		},
	},
	required: ["diagramType"],
}

export interface MermaidFixerOptions {
	geminiApiKey?: string
	geminiModel?: string
}

export class MermaidDiagramFixer {
	private client: GoogleGenAI | null = null
	private modelName: string

	constructor(private options: MermaidFixerOptions = {}) {
		this.modelName = options.geminiModel || "gemini-2.0-flash-exp"
		if (options.geminiApiKey) {
			this.client = new GoogleGenAI({ apiKey: options.geminiApiKey })
		}
	}

	/**
	 * Fix a Mermaid diagram with syntax errors using Gemini AI
	 * @param invalidCode The invalid Mermaid code
	 * @param errorMessage The error message from Mermaid parser
	 * @returns Fixed Mermaid code
	 * @throws Error if API key is missing or fixing fails
	 */
	async fixDiagram(invalidCode: string, errorMessage: string): Promise<string> {
		if (!this.client || !this.options.geminiApiKey || this.options.geminiApiKey.trim() === "") {
			throw new Error("Gemini API key is required for diagram fixing")
		}

		try {
			// Stage 1: Generate structured JSON representation
			const structuredJson = await this.generateStructuredJson(invalidCode, errorMessage)
			if (!structuredJson) {
				throw new Error("Failed to fix Mermaid diagram")
			}

			// Stage 2: Validate JSON against schema
			const validationResult = this.validateJson(structuredJson)
			if (!validationResult.valid) {
				console.error("JSON validation failed:", validationResult.errors)
				throw new Error("Failed to fix Mermaid diagram")
			}

			// Stage 3: Generate Python code to convert JSON to Mermaid
			const pythonCode = await this.generatePythonConverter(structuredJson)
			if (!pythonCode) {
				throw new Error("Failed to fix Mermaid diagram")
			}

			// Stage 4: Execute Python code to get final Mermaid DSL
			const fixedMermaid = await this.executePythonCode(pythonCode, structuredJson)
			if (!fixedMermaid) {
				throw new Error("Failed to fix Mermaid diagram")
			}

			// Post-process and validate the result
			const cleanedMermaid = this.postProcessMermaid(fixedMermaid)
			return cleanedMermaid
		} catch (error) {
			console.error("Error fixing Mermaid diagram:", error)
			if (error instanceof Error && error.message === "Gemini API key is required for diagram fixing") {
				throw error
			}
			throw new Error("Failed to fix Mermaid diagram")
		}
	}

	private async generateStructuredJson(invalidCode: string, errorMessage: string): Promise<any> {
		const prompt = `
You are a Mermaid diagram expert. Analyze this invalid Mermaid code and its error message, then generate a corrected version as a structured JSON object.

Invalid Mermaid Code:
\`\`\`mermaid
${invalidCode}
\`\`\`

Error Message:
${errorMessage}

Generate a JSON object that represents the corrected diagram structure. The JSON should follow this schema:
${JSON.stringify(MERMAID_JSON_SCHEMA, null, 2)}

Rules:
1. NO parentheses in any labels or text
2. Use only alphanumeric characters, spaces, and basic punctuation in labels
3. Ensure all node IDs are unique and valid
4. Fix any syntax errors while preserving the original intent
5. Return ONLY valid JSON, no markdown or explanations

Response:`

		try {
			const model = this.client!.models.generateContent({
				model: this.modelName,
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				config: {
					temperature: 0.1,
					maxOutputTokens: 2048,
				},
			})

			const result = await model
			const text = result.text || ""

			// Try to parse as JSON
			const json = safeJsonParse(text, null)
			if (!json) {
				console.error("Failed to parse JSON from Gemini response:", text)
				return null
			}

			return json
		} catch (error) {
			console.error("Error generating structured JSON:", error)
			return null
		}
	}

	private validateJson(json: any): { valid: boolean; errors?: string[] } {
		// Basic validation - check required fields and structure
		const errors: string[] = []

		if (!json.diagramType) {
			errors.push("Missing required field: diagramType")
		}

		// Check for parentheses in labels
		const checkForParentheses = (obj: any, path: string = "") => {
			if (typeof obj === "string" && (obj.includes("(") || obj.includes(")"))) {
				errors.push(`Parentheses found in ${path}: "${obj}"`)
			} else if (Array.isArray(obj)) {
				obj.forEach((item, index) => checkForParentheses(item, `${path}[${index}]`))
			} else if (obj && typeof obj === "object") {
				Object.entries(obj).forEach(([key, value]) => {
					checkForParentheses(value, path ? `${path}.${key}` : key)
				})
			}
		}

		checkForParentheses(json)

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
		}
	}

	private async generatePythonConverter(json: any): Promise<string | null> {
		const prompt = `
Generate a Python function that converts this JSON structure into valid Mermaid DSL syntax.

JSON Structure:
${JSON.stringify(json, null, 2)}

Requirements:
1. The function should be named 'json_to_mermaid'
2. It should take the JSON object as input
3. It should return a string containing valid Mermaid DSL
4. Handle the specific diagram type (${json.diagramType})
5. Ensure proper Mermaid syntax for the diagram type
6. NO parentheses in any output
7. Use proper escaping for special characters

Return ONLY the Python code, no explanations or markdown.`

		try {
			const model = this.client!.models.generateContent({
				model: this.modelName,
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				config: {
					temperature: 0.1,
					maxOutputTokens: 2048,
				},
			})

			const result = await model
			const code = result.text || ""

			// Clean up the code if it has markdown
			const cleanCode = code
				.replace(/```python\n?/g, "")
				.replace(/```\n?/g, "")
				.trim()

			return cleanCode
		} catch (error) {
			console.error("Error generating Python converter:", error)
			return null
		}
	}

	private async executePythonCode(pythonCode: string, json: any): Promise<string | null> {
		// Since we can't actually execute Python in the browser/extension context,
		// we'll use Gemini's code execution capability
		const prompt = `
Execute this Python code with the provided JSON input and return the output:

Python Code:
\`\`\`python
${pythonCode}

# Execute the function
import json
json_data = ${JSON.stringify(json)}
result = json_to_mermaid(json_data)
print(result)
\`\`\`

Return ONLY the Mermaid DSL output, no explanations or markdown.`

		try {
			const model = this.client!.models.generateContent({
				model: this.modelName,
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				config: {
					temperature: 0,
					maxOutputTokens: 2048,
				},
			})

			const result = await model
			const mermaidCode = result.text || ""

			// Clean up the output
			const cleanMermaid = mermaidCode
				.replace(/```mermaid\n?/g, "")
				.replace(/```\n?/g, "")
				.trim()

			return cleanMermaid
		} catch (error) {
			console.error("Error executing Python code:", error)
			return null
		}
	}

	private postProcessMermaid(mermaidCode: string): string {
		// Remove any remaining parentheses
		let cleaned = mermaidCode.replace(/[()]/g, "")

		// Ensure proper line endings
		cleaned = cleaned.replace(/\r\n/g, "\n")

		// Remove any duplicate whitespace
		cleaned = cleaned.replace(/  +/g, " ")

		// Trim each line
		cleaned = cleaned
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.join("\n")

		return cleaned
	}
}
