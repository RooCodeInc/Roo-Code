import type { ProviderSettings } from "@roo-code/types"

import { buildApiHandler, type SingleCompletionHandler } from "../../../api"

type RpiStrategy = "quick" | "standard" | "full"

export interface RpiCouncilInput {
	taskSummary: string
	taskText: string
	mode: string
	strategy: RpiStrategy
	maxPromptChars: number
}

export interface RpiCouncilResult {
	summary: string
	findings: string[]
	risks: string[]
	rawResponse: string
}

type CouncilAction = "analyze_context" | "decompose_task" | "build_decision" | "verification_review"

const MAX_FINDINGS = 6
const MAX_RISKS = 4

export class RpiCouncilEngine {
	async analyzeContext(apiConfiguration: ProviderSettings, input: RpiCouncilInput): Promise<RpiCouncilResult> {
		return this.runAction(apiConfiguration, input, "analyze_context")
	}

	async decomposeTask(apiConfiguration: ProviderSettings, input: RpiCouncilInput): Promise<RpiCouncilResult> {
		return this.runAction(apiConfiguration, input, "decompose_task")
	}

	async buildDecision(apiConfiguration: ProviderSettings, input: RpiCouncilInput): Promise<RpiCouncilResult> {
		return this.runAction(apiConfiguration, input, "build_decision")
	}

	async runVerificationReview(apiConfiguration: ProviderSettings, input: RpiCouncilInput): Promise<RpiCouncilResult> {
		return this.runAction(apiConfiguration, input, "verification_review")
	}

	private async runAction(
		apiConfiguration: ProviderSettings,
		input: RpiCouncilInput,
		action: CouncilAction,
	): Promise<RpiCouncilResult> {
		const prompt = this.buildPrompt(input, action)
		const rawResponse = await this.completePromptWithActiveProvider(apiConfiguration, prompt)
		return this.parseStructuredResult(rawResponse, action)
	}

	private async completePromptWithActiveProvider(
		apiConfiguration: ProviderSettings,
		prompt: string,
	): Promise<string> {
		const handler = buildApiHandler(apiConfiguration)
		if (!("completePrompt" in handler)) {
			throw new Error("Active provider does not support single-prompt completions for RPI council engine.")
		}

		return (handler as SingleCompletionHandler).completePrompt(prompt)
	}

	private buildPrompt(input: RpiCouncilInput, action: CouncilAction): string {
		const taskSummary = this.clampText(input.taskSummary, 480)
		const taskText = this.clampText(input.taskText, Math.max(400, input.maxPromptChars))
		const actionInstruction = this.getActionInstruction(action)

		return [
			"You are Roo internal council engine.",
			"Return valid JSON only with this exact shape:",
			`{"summary":"string","findings":["string"],"risks":["string"]}`,
			"Rules:",
			"- Keep summary concise and actionable.",
			"- findings must be specific and execution-oriented.",
			"- risks must only include real blockers or residual risks.",
			"- Do not add markdown, explanations, or extra keys.",
			"",
			`Mode: ${input.mode}`,
			`Strategy: ${input.strategy}`,
			`Action: ${action}`,
			"",
			`Action details: ${actionInstruction}`,
			"",
			`Task summary: ${taskSummary}`,
			"",
			"Task details:",
			taskText,
		].join("\n")
	}

	private getActionInstruction(action: CouncilAction): string {
		switch (action) {
			case "analyze_context":
				return "Identify constraints, unknowns, and complexity signals. Keep findings as short factual bullets."
			case "decompose_task":
				return "Break task into atomic execution-oriented phases without creating a todo list."
			case "build_decision":
				return "Propose the next technical decision with rationale and tradeoffs."
			case "verification_review":
				return "Review implementation readiness and highlight residual risks before completion."
		}
	}

	private parseStructuredResult(rawResponse: string, action: CouncilAction): RpiCouncilResult {
		const parsed = this.tryParseJson(rawResponse)
		if (!parsed) {
			const fallbackSummary = this.clampText(rawResponse.replace(/\s+/g, " ").trim(), 200)
			return {
				summary: fallbackSummary || `Council ${action} completed.`,
				findings: [],
				risks: [],
				rawResponse,
			}
		}

		const summary = this.ensureString(parsed.summary)
		const findings = this.ensureStringArray(parsed.findings, MAX_FINDINGS)
		const risks = this.ensureStringArray(parsed.risks, MAX_RISKS)

		return {
			summary: summary || `Council ${action} completed.`,
			findings,
			risks,
			rawResponse,
		}
	}

	private tryParseJson(rawResponse: string): Record<string, unknown> | undefined {
		const direct = this.parseCandidate(rawResponse)
		if (direct) {
			return direct
		}

		const fencedMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/i)
		if (!fencedMatch?.[1]) {
			return undefined
		}

		return this.parseCandidate(fencedMatch[1])
	}

	private parseCandidate(candidate: string): Record<string, unknown> | undefined {
		try {
			const parsed = JSON.parse(candidate.trim())
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
				return parsed as Record<string, unknown>
			}
			return undefined
		} catch {
			return undefined
		}
	}

	private ensureString(value: unknown): string {
		return typeof value === "string" ? this.clampText(value.trim(), 220) : ""
	}

	private ensureStringArray(value: unknown, maxItems: number): string[] {
		if (!Array.isArray(value)) {
			return []
		}

		return value
			.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
			.slice(0, maxItems)
			.map((entry) => this.clampText(entry.trim(), 220))
	}

	private clampText(text: string, maxChars: number): string {
		if (text.length <= maxChars) {
			return text
		}
		return `${text.slice(0, Math.max(0, maxChars - 3))}...`
	}
}
