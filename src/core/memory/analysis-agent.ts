import type { AnalysisResult, Observation, ObservationAction, MemoryCategorySlug } from "./types"
import { buildApiHandler, type SingleCompletionHandler } from "../../api"
import type { ProviderSettings } from "@roo-code/types"

const VALID_CATEGORIES = new Set<string>([
	"coding-style",
	"communication-prefs",
	"technical-proficiency",
	"tool-preferences",
	"active-projects",
	"behavioral-patterns",
	"dislikes-frustrations",
])

const VALID_ACTIONS = new Set<string>(["NEW", "REINFORCE", "UPDATE"])

const ANALYSIS_SYSTEM_PROMPT = `You are a User Profile Analyst. Your job is to extract factual observations about the USER from conversation transcripts between them and a coding assistant.

You will receive:
1. A cleaned conversation transcript (tool noise already removed)
2. The current compiled memory report (what is already known)

EXTRACT observations about the user in these categories:
- coding-style: Languages, frameworks, patterns, conventions they prefer
- communication-prefs: Response length, tone, detail level they want
- technical-proficiency: Skill levels in specific technologies
- tool-preferences: Tools, linters, formatters, workflows they favor
- active-projects: What they're currently building (time-bound)
- behavioral-patterns: How they iterate, review, debug, make decisions
- dislikes-frustrations: Things that annoy them or they explicitly reject

RULES:
- Only extract what is EVIDENCED in the transcript. Never infer beyond what's shown.
- If an observation matches something in the existing memory, mark it as REINFORCE (don't create a duplicate).
- If an observation contradicts existing memory, mark it as UPDATE with the new value.
- If it's completely new, mark it as NEW.
- Write each observation as a concise, third-person factual statement (e.g., "Prefers functional React components over class components")
- Assign significance 0.0-1.0 based on how broadly useful this fact is for future interactions.

PRIVACY — NEVER extract:
- Real names, emails, addresses, phone numbers
- API keys, passwords, secrets, tokens
- Company confidential or proprietary details
- Health, financial, legal, or relationship information
- Anything the user explicitly marks as private or off-record

If the conversation contains mostly one-liners or nothing personality-revealing, return an empty observations array. Don't force extraction.

Respond in this exact JSON format (no markdown fences, just raw JSON):
{
  "observations": [
    {
      "action": "NEW" | "REINFORCE" | "UPDATE",
      "category": "<category-slug>",
      "content": "<concise factual statement>",
      "significance": <0.0-1.0>,
      "existing_entry_id": "<id if REINFORCE or UPDATE, null if NEW>",
      "reasoning": "<one sentence why this matters>"
    }
  ],
  "session_summary": "<1-2 sentences about what the user was doing this session>"
}`

/** Send a preprocessed conversation to the LLM for memory extraction. */
export async function runAnalysis(
	providerSettings: ProviderSettings,
	cleanedConversation: string,
	existingMemoryReport: string,
): Promise<AnalysisResult | null> {
	try {
		const handler = buildApiHandler(providerSettings)

		// Check if handler supports single completion
		if (!("completePrompt" in handler)) {
			console.error("[MemoryAgent] Handler does not support completePrompt")
			return null
		}

		const prompt = `EXISTING MEMORY:\n${existingMemoryReport}\n\n---\n\nCONVERSATION TRANSCRIPT:\n${cleanedConversation}`

		const response = await (handler as unknown as SingleCompletionHandler).completePrompt(
			`${ANALYSIS_SYSTEM_PROMPT}\n\n${prompt}`,
		)

		return parseAnalysisResponse(response)
	} catch (error) {
		console.error("[MemoryAgent] Analysis failed:", error)
		return null
	}
}

/** Parse and validate the LLM's JSON response into typed observations. */
function parseAnalysisResponse(response: string): AnalysisResult | null {
	try {
		// Strip markdown code fences if present
		const cleaned = response.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "").trim()
		const parsed = JSON.parse(cleaned)

		if (!parsed.observations || !Array.isArray(parsed.observations)) {
			return { observations: [], sessionSummary: parsed.session_summary || "" }
		}

		// Validate and filter observations
		const validObservations: Observation[] = parsed.observations
			.filter((obs: Record<string, unknown>) => {
				return (
					VALID_ACTIONS.has(obs.action as string) &&
					VALID_CATEGORIES.has(obs.category as string) &&
					typeof obs.content === "string" &&
					(obs.content as string).length > 0 &&
					typeof obs.significance === "number" &&
					(obs.significance as number) >= 0 &&
					(obs.significance as number) <= 1
				)
			})
			.map((obs: Record<string, unknown>) => ({
				action: obs.action as ObservationAction,
				category: obs.category as MemoryCategorySlug,
				content: obs.content as string,
				significance: obs.significance as number,
				existingEntryId: (obs.existing_entry_id as string) || null,
				reasoning: (obs.reasoning as string) || "",
			}))

		return {
			observations: validObservations,
			sessionSummary: parsed.session_summary || "",
		}
	} catch (error) {
		console.error("[MemoryAgent] Failed to parse response:", error)
		return null
	}
}
