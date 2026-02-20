import type { ProviderSettings } from "@siid-code/types"
import type { Anthropic } from "@anthropic-ai/sdk"

/**
 * Result of task complexity analysis
 */
export interface ComplexityAnalysis {
	isComplex: boolean
	reasoning: string
	filename: string // AI-generated filename for the planning file
	planContent: string // AI-generated content for the planning file
}

/**
 * Analyzes task complexity using the same AI model that will execute the task
 * This call determines if a planning file should be created and what content it should have
 *
 * @param prompt - The user's task prompt
 * @param apiConfig - The user's API configuration (model, provider, credentials)
 * @returns Complexity analysis result
 */
export async function analyzeTaskComplexity(prompt: string, apiConfig: ProviderSettings): Promise<ComplexityAnalysis> {
	if (!prompt || !apiConfig) {
		return {
			isComplex: false,
			reasoning: "Unable to analyze - missing prompt or API configuration",
			filename: "task",
			planContent: "",
		}
	}

	try {
		// Use the buildApiHandler to get the user's configured model
		const { buildApiHandler } = await import("../../api")
		const apiHandler = buildApiHandler(apiConfig)

		if (!apiHandler) {
			return {
				isComplex: false,
				reasoning: "Could not initialize API handler",
				filename: "task",
				planContent: "",
			}
		}

		const systemPrompt = `You are a task complexity analyzer and plan generator. 

Determine if a task requires multi-phase planning. If complex, also generate:
1. A descriptive filename (2-4 words, lowercase, hyphens only)
2. The initial plan file content (markdown format showing phases)

COMPLEX task criteria:
- Multiple sequential phases with dependencies
- 3+ different technologies/components (Apex, LWC, Trigger, Flow, etc.)
- Coordination between multiple parts
- Complex architectural decisions needed
- 5+ distinct deliverables

SIMPLE task criteria:
- Single component (one class, one LWC, one object, one trigger)
- Single-step execution
- Straightforward implementation
- No dependencies between parts

For the plan content, create a markdown structure with:
- Original Request section
- Phase breakdown with deliverables
- Execution log template

Respond with ONLY this JSON format (no markdown, pure JSON):
{
  "isComplex": true/false,
  "reasoning": "one sentence explanation",
  "filename": "descriptive-task-name or empty string if not complex",
  "planContent": "markdown content for plan file or empty string if not complex"
}`

		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: `Analyze task complexity and generate plan structure if needed:\n\n${prompt}`,
			},
		]

		// Stream and collect the response
		let textContent = ""
		const stream = apiHandler.createMessage(systemPrompt, messages)

		for await (const chunk of stream) {
			if (chunk.type === "text") {
				textContent += chunk.text
			}
		}

		// Parse the JSON response
		const parsed = JSON.parse(textContent)

		return {
			isComplex: parsed.isComplex === true,
			reasoning: parsed.reasoning || "Task complexity analyzed",
			filename: parsed.filename || "task",
			planContent: parsed.planContent || "",
		}
	} catch (error) {
		console.warn("Error analyzing task complexity:", error)
		// Default to simple if analysis fails
		return {
			isComplex: false,
			reasoning: "Analysis unavailable - proceeding without planning file",
			filename: "task",
			planContent: "",
		}
	}
}
