// src/core/multi-orchestrator/plan-generator.ts
import type { ProviderSettings, ModeConfig } from "@roo-code/types"
import { buildApiHandler, type SingleCompletionHandler } from "../../api"
import type { OrchestratorPlan, PlannedTask } from "./types"
import { generateAgentId } from "./types"

const PLAN_SYSTEM_PROMPT = `You are a task decomposition engine. Given a user request, break it into independent parallel tasks that can be executed by separate agents simultaneously.

IMPORTANT: You are powering a MULTI-AGENT system. The whole point is to split work across multiple agents working in parallel. When the request is non-trivial, you SHOULD create multiple tasks. A single task defeats the purpose of multi-agent orchestration.

For each task:
- Assign the most appropriate mode from the available modes list
- Write a clear, self-contained task description that an agent can execute independently
- List expected files the agent will touch (for merge conflict prevention)
- Ensure tasks are as independent as possible — minimize file overlap

TASK COUNT GUIDELINES:
- Trivial single-file tasks (e.g., "make a calculator"): 1 task is acceptable
- Small multi-file tasks (e.g., "add a login page"): 2 tasks
- Medium features (e.g., "build user auth with tests"): 3-4 tasks
- Large multi-module features: up to the max agent count
- If the max agent count is > 1 and the request involves multiple files or concerns, you SHOULD use multiple tasks
- NEVER create a separate task for documentation unless explicitly requested
- NEVER create separate tasks for HTML, CSS, and JS of the same component — that's ONE task
- Each task should produce a COMPLETE, working piece of functionality

CRITICAL RULES:
- Do NOT assign "architect" mode as a parallel task. Architecture decisions should be embedded in the task descriptions themselves.
- The orchestrator has already analyzed the request — each code task should include the architectural context it needs.
- Only use these modes for parallel tasks: "code" (implementation), "ask" (research), "debug" (fixing)
- For truly trivial tasks (like "make a calculator"), a single "code" agent is fine.
- But for anything involving multiple files, modules, or separable concerns, USE MULTIPLE TASKS.
- Never create more tasks than the specified max agent count.

You MUST respond with valid JSON only. No markdown code fences. No explanation text. Just the JSON object.

Response format:
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
		console.log("[MultiOrch:Plan] ========== PLAN GENERATION START ==========")
		console.log("[MultiOrch:Plan] generatePlan called with maxAgents:", maxAgents)
		console.log("[MultiOrch:Plan] userRequest:", userRequest)

		const handler = buildApiHandler(providerSettings)

		if (!("completePrompt" in handler)) {
			console.error("[MultiOrch:Plan] Handler does not support completePrompt — provider type:", providerSettings?.apiProvider ?? "unknown")
			return null
		}

		const modeList = availableModes
			.filter((m) => !["multi-orchestrator", "orchestrator", "architect"].includes(m.slug))
			.map((m) => `- ${m.slug}: ${m.description || m.name}`)
			.join("\n")

		console.log("[MultiOrch:Plan] Available modes for plan:\n", modeList)

		const prompt = `Available modes:\n${modeList}\n\nMax agents available: ${maxAgents}. You SHOULD use up to ${maxAgents} tasks if the request warrants it. You MUST NOT exceed ${maxAgents} tasks.\n\nUser request:\n${userRequest}`

		const fullPrompt = `${PLAN_SYSTEM_PROMPT}\n\n${prompt}`
		console.log(`[MultiOrch:Plan] Sending prompt (${fullPrompt.length} chars)`)
		console.log("[MultiOrch:Plan] === FULL PROMPT START ===")
		console.log(fullPrompt)
		console.log("[MultiOrch:Plan] === FULL PROMPT END ===")

		const response = await (handler as unknown as SingleCompletionHandler).completePrompt(fullPrompt)

		// Null/empty response check
		if (!response || response.trim().length === 0) {
			console.error("[MultiOrch:Plan] ❌ completePrompt returned null/empty response!")
			console.error("[MultiOrch:Plan] response value:", JSON.stringify(response))
			return null
		}

		console.log(`[MultiOrch:Plan] Raw response (${response.length} chars):`)
		console.log(`[MultiOrch:Plan] Raw response: ${response.substring(0, 500)}`)
		if (response.length > 500) {
			console.log(`[MultiOrch:Plan] ... (${response.length - 500} more chars)`)
			console.log(`[MultiOrch:Plan] Raw response tail: ...${response.substring(response.length - 200)}`)
		}

		const plan = parsePlanResponse(response, maxAgents)

		if (!plan) {
			console.error("[MultiOrch:Plan] ❌ parsePlanResponse returned null — could not parse LLM response")
			return null
		}

		console.log(`[MultiOrch:Plan] Parsed ${plan.tasks.length} tasks`)
		for (const task of plan.tasks) {
			console.log(`[MultiOrch:Plan]   Task "${task.title}" [mode=${task.mode}, priority=${task.priority}, files=${(task.assignedFiles ?? []).join(",")}]`)
		}
		console.log(`[MultiOrch:Plan] requiresMerge=${plan.requiresMerge}, estimatedComplexity=${plan.estimatedComplexity}`)

		// Warn if LLM returned only 1 task but we requested multiple
		if (plan.tasks.length === 1 && maxAgents > 1) {
			console.warn("[MultiOrch:Plan] ⚠️ WARNING: LLM returned only 1 task but maxAgents=" + maxAgents + ". The prompt may not be eliciting multi-task plans. Review system prompt or user request complexity.")
		}

		console.log("[MultiOrch:Plan] ========== PLAN GENERATION END (returning", plan.tasks.length, "tasks) ==========")
		return plan
	} catch (error) {
		console.error("[MultiOrch:Plan] ❌ Plan generation failed:", error)
		return null
	}
}

function parsePlanResponse(response: string, maxAgents: number): OrchestratorPlan | null {
	try {
		// Step 1: Strip markdown code fences if present (handles ```json, ```, triple backticks with language tags)
		let cleaned = response.trim()

		// Handle various markdown fence patterns
		const fencePatterns = [
			/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/,    // ```json ... ``` or ``` ... ```
			/^`{3,}(?:json)?\s*\n?([\s\S]*?)\n?\s*`{3,}$/, // variable-length fences
		]

		for (const pattern of fencePatterns) {
			const match = cleaned.match(pattern)
			if (match) {
				console.log("[MultiOrch:Plan] Stripped markdown code fence from response")
				cleaned = match[1].trim()
				break
			}
		}

		// Step 2: If response starts with text before JSON, try to extract the JSON object
		if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
			const jsonStart = cleaned.indexOf("{")
			if (jsonStart !== -1) {
				console.log("[MultiOrch:Plan] Response had leading text before JSON, extracting from index", jsonStart)
				cleaned = cleaned.substring(jsonStart)
			}
		}

		// Step 3: If there's trailing text after the JSON, try to extract just the JSON
		// Find the matching closing brace
		if (cleaned.startsWith("{")) {
			let braceDepth = 0
			let jsonEnd = -1
			for (let i = 0; i < cleaned.length; i++) {
				if (cleaned[i] === "{") braceDepth++
				else if (cleaned[i] === "}") {
					braceDepth--
					if (braceDepth === 0) {
						jsonEnd = i + 1
						break
					}
				}
			}
			if (jsonEnd !== -1 && jsonEnd < cleaned.length) {
				console.log("[MultiOrch:Plan] Response had trailing text after JSON, trimming at index", jsonEnd)
				cleaned = cleaned.substring(0, jsonEnd)
			}
		}

		console.log("[MultiOrch:Plan] Cleaned response for parsing:", cleaned.substring(0, 300))

		let parsed: Record<string, unknown>

		try {
			parsed = JSON.parse(cleaned)
		} catch (jsonError) {
			console.error("[MultiOrch:Plan] ❌ JSON.parse failed:", (jsonError as Error).message)
			console.error("[MultiOrch:Plan] Attempted to parse:", cleaned.substring(0, 500))
			return null
		}

		// Step 4: Handle edge case — LLM returns a single task object instead of {tasks: [...]}
		if (!parsed.tasks && parsed.mode && parsed.title) {
			console.warn("[MultiOrch:Plan] ⚠️ LLM returned a single task object instead of {tasks: [...]}, wrapping it")
			parsed = {
				tasks: [parsed],
				requiresMerge: parsed.mode === "code",
				estimatedComplexity: "low",
			}
		}

		// Step 5: Handle edge case — LLM returns an array directly instead of {tasks: [...]}
		if (Array.isArray(parsed)) {
			console.warn("[MultiOrch:Plan] ⚠️ LLM returned a bare array instead of {tasks: [...]}, wrapping it")
			parsed = {
				tasks: parsed,
				requiresMerge: (parsed as unknown as Record<string, unknown>[]).some((t) => t.mode === "code"),
				estimatedComplexity: "medium",
			}
		}

		if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
			console.error("[MultiOrch:Plan] ❌ parsed.tasks is missing or not an array. Keys found:", Object.keys(parsed))
			return null
		}

		if ((parsed.tasks as unknown[]).length === 0) {
			console.error("[MultiOrch:Plan] ❌ parsed.tasks is an empty array")
			return null
		}

		let tasks: PlannedTask[] = (parsed.tasks as Record<string, unknown>[]).map((t: Record<string, unknown>, i: number) => ({
			id: generateAgentId(),
			mode: (t.mode as string) || "code",
			title: (t.title as string) || `Task ${i + 1}`,
			description: (t.description as string) || "",
			assignedFiles: (t.assignedFiles as string[]) || [],
			priority: (t.priority as number) || i + 1,
		}))

		console.log("[MultiOrch:Plan] Successfully mapped", tasks.length, "tasks from parsed JSON")

		// Hard-enforce the agent limit
		if (tasks.length > maxAgents) {
			console.log("[MultiOrch:Plan] Clamping task count from", tasks.length, "to maxAgents=", maxAgents)
			tasks = tasks.slice(0, maxAgents)
		}

		return {
			tasks,
			requiresMerge: (parsed.requiresMerge as boolean) ?? tasks.some((t) => t.mode === "code"),
			estimatedComplexity: (parsed.estimatedComplexity as string as "low" | "medium" | "high") || "medium",
		}
	} catch (error) {
		console.error("[MultiOrch:Plan] ❌ Failed to parse plan response:", error)
		console.error("[MultiOrch:Plan] Raw response was:", response?.substring(0, 500))
		return null
	}
}
