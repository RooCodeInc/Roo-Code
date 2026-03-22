// src/core/multi-orchestrator/plan-generator.ts
import type { ProviderSettings, ModeConfig } from "@roo-code/types"
import { buildApiHandler, type SingleCompletionHandler } from "../../api"
import type { OrchestratorPlan, PlannedTask } from "./types"
import { generateAgentId } from "./types"

const PLAN_SYSTEM_PROMPT = `You are a task decomposition engine. Given a user request, break it into independent parallel tasks.

For each task:
- Assign the most appropriate mode: "code" (implementation), "architect" (design/planning), "ask" (research/questions), "debug" (fixing issues)
- Write a clear, self-contained task description that an agent can execute independently
- List expected files the agent will touch (for merge conflict prevention)
- Ensure tasks are as independent as possible — minimize file overlap

Respond in this exact JSON format (no markdown fences):
{
  "tasks": [
    {
      "mode": "<mode-slug>",
      "title": "<short title>",
      "description": "<full task prompt for the agent>",
      "assignedFiles": ["<expected files>"],
      "priority": <1-N>
    }
  ],
  "requiresMerge": <true if any task uses "code" mode>,
  "estimatedComplexity": "<low|medium|high>"
}`

export async function generatePlan(
	userRequest: string,
	availableModes: ModeConfig[],
	maxAgents: number,
	providerSettings: ProviderSettings,
): Promise<OrchestratorPlan | null> {
	try {
		const handler = buildApiHandler(providerSettings)

		if (!("completePrompt" in handler)) {
			console.error("[MultiOrch] Handler does not support completePrompt")
			return null
		}

		const modeList = availableModes
			.filter((m) => m.slug !== "multi-orchestrator" && m.slug !== "orchestrator")
			.map((m) => `- ${m.slug}: ${m.description || m.name}`)
			.join("\n")

		const prompt = `Available modes:\n${modeList}\n\nMax parallel tasks: ${maxAgents}\n\nUser request:\n${userRequest}`

		const response = await (handler as unknown as SingleCompletionHandler).completePrompt(
			`${PLAN_SYSTEM_PROMPT}\n\n${prompt}`,
		)

		return parsePlanResponse(response)
	} catch (error) {
		console.error("[MultiOrch] Plan generation failed:", error)
		return null
	}
}

function parsePlanResponse(response: string): OrchestratorPlan | null {
	try {
		const cleaned = response.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "").trim()
		const parsed = JSON.parse(cleaned)

		if (!parsed.tasks || !Array.isArray(parsed.tasks)) return null

		const tasks: PlannedTask[] = parsed.tasks.map((t: Record<string, unknown>, i: number) => ({
			id: generateAgentId(),
			mode: (t.mode as string) || "code",
			title: (t.title as string) || `Task ${i + 1}`,
			description: (t.description as string) || "",
			assignedFiles: (t.assignedFiles as string[]) || [],
			priority: (t.priority as number) || i + 1,
		}))

		return {
			tasks,
			requiresMerge: parsed.requiresMerge ?? tasks.some((t) => t.mode === "code"),
			estimatedComplexity: parsed.estimatedComplexity || "medium",
		}
	} catch (error) {
		console.error("[MultiOrch] Failed to parse plan:", error)
		return null
	}
}
