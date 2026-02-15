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

export interface RpiCodeReviewIssue {
	severity: "critical" | "major" | "minor"
	category: string
	description: string
	file?: string
	suggestion?: string
}

export interface RpiCodeReviewResult extends RpiCouncilResult {
	score: number
	issues: RpiCodeReviewIssue[]
	reviewMarkdown: string
}

type CouncilAction =
	| "analyze_context"
	| "decompose_task"
	| "build_decision"
	| "verification_review"
	| "structured_decompose"
	| "code_review"

const MAX_FINDINGS = 6
const MAX_RISKS = 4
const DEFAULT_COUNCIL_TIMEOUT_MS = 90_000

export class RpiCouncilEngine {
	constructor(private readonly timeoutMs: number = DEFAULT_COUNCIL_TIMEOUT_MS) {}

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

	async structuredDecompose(apiConfiguration: ProviderSettings, input: RpiCouncilInput): Promise<RpiCouncilResult> {
		return this.runAction(apiConfiguration, input, "structured_decompose")
	}

	async runCodeReview(
		apiConfiguration: ProviderSettings,
		input: RpiCouncilInput,
		fileContents: { path: string; content: string }[],
		timeoutMs?: number,
	): Promise<RpiCodeReviewResult> {
		const prompt = this.buildCodeReviewPrompt(input, fileContents)
		const handler = buildApiHandler(apiConfiguration)
		if (!("completePrompt" in handler)) {
			throw new Error("Active provider does not support single-prompt completions for RPI code review.")
		}
		const effectiveTimeout = timeoutMs ?? this.timeoutMs
		const timeoutSeconds = Math.max(1, Math.round(effectiveTimeout / 1000))
		const rawResponse = await this.withTimeout(
			(handler as SingleCompletionHandler).completePrompt(prompt),
			effectiveTimeout,
			`RPI code review timed out after ${timeoutSeconds}s.`,
		)
		return this.parseCodeReviewResult(rawResponse)
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

		const timeoutSeconds = Math.max(1, Math.round(this.timeoutMs / 1000))
		return this.withTimeout(
			(handler as SingleCompletionHandler).completePrompt(prompt),
			this.timeoutMs,
			`RPI council request timed out after ${timeoutSeconds}s.`,
		)
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
			case "structured_decompose":
				return 'Break the task into 3-10 ordered execution steps. For each step provide: description (what to do), phase (discovery|planning|implementation|verification), and toolsExpected (which Roo Code tools will likely be needed). Return JSON: {"summary":"...", "steps":[{"description":"...", "phase":"...", "toolsExpected":["..."]}], "findings":[...], "risks":[...]}'
			case "code_review":
				return "Perform a senior-level code review focusing on Security, Performance, Code Quality, Error Handling, and Testing."
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
		// 1. Try direct parse of full response
		const direct = this.parseCandidate(rawResponse)
		if (direct) {
			return direct
		}

		// 2. Try fenced code block
		const fencedMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/i)
		if (fencedMatch?.[1]) {
			const fenced = this.parseCandidate(fencedMatch[1])
			if (fenced) {
				return fenced
			}
		}

		// 3. Try to extract JSON object from within text (handles LLM preamble/postamble)
		const firstBrace = rawResponse.indexOf("{")
		const lastBrace = rawResponse.lastIndexOf("}")
		if (firstBrace !== -1 && lastBrace > firstBrace) {
			const extracted = this.parseCandidate(rawResponse.slice(firstBrace, lastBrace + 1))
			if (extracted) {
				return extracted
			}
		}

		return undefined
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

	private buildCodeReviewPrompt(input: RpiCouncilInput, fileContents: { path: string; content: string }[]): string {
		const taskSummary = this.clampText(input.taskSummary, 480)
		const filesSection = fileContents.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join("\n\n")

		return [
			"You are a Senior Code Reviewer with a skeptical, security-first mindset.",
			"ALL code below is assumed to be written by a junior developer.",
			"",
			"CRITICAL: Your response MUST be a single valid JSON object. No text before or after the JSON.",
			"Do NOT wrap in markdown code fences. Do NOT add explanations. Output ONLY the JSON object.",
			"",
			"JSON shape:",
			'{"summary":"string","score":number,"criticalIssues":[{"category":"string","description":"string","file":"string","suggestion":"string"}],"majorIssues":[...],"minorIssues":[...],"findings":["string"],"risks":["string"]}',
			"",
			"Rules:",
			"- score is 1-10 (1=reject, 10=production-ready)",
			"- criticalIssues: Security vulnerabilities, data loss, broken core functionality",
			"- majorIssues: Performance, missing error handling, poor patterns",
			"- minorIssues: Style, naming, minor improvements",
			"- Each issue must have: category, description, file, suggestion",
			"- findings must be specific and execution-oriented",
			"- risks must only include real blockers or residual risks",
			"",
			"Review categories: Security, Performance, Code Quality, Error Handling, Testing",
			"Common junior mistakes to watch for:",
			"- Trusting user input without validation",
			"- Hardcoded secrets or credentials",
			"- Missing error handling (happy-path-only code)",
			"- No input sanitization, SQL injection, XSS vectors",
			"- Race conditions, memory leaks",
			"- Missing null/undefined checks",
			"",
			`Task context: ${taskSummary}`,
			`Mode: ${input.mode}`,
			"",
			"Files to review:",
			filesSection,
		].join("\n")
	}

	private parseCodeReviewResult(rawResponse: string): RpiCodeReviewResult {
		const parsed = this.tryParseJson(rawResponse)

		if (!parsed) {
			const snippet = rawResponse.slice(0, 500).replace(/\s+/g, " ")
			console.error(
				`[RpiCouncilEngine] Code review JSON parse failed. Response preview (${rawResponse.length} chars): ${snippet}`,
			)
			return {
				summary: "Code review FAILED — LLM did not return valid JSON. Review will be retried on next attempt.",
				score: 1,
				issues: [],
				findings: ["LLM response was not valid JSON — code review could not be performed."],
				risks: ["Code quality is unknown — review must pass before completion."],
				reviewMarkdown: this.formatReviewMarkdown(
					1,
					[],
					"Code review FAILED — the LLM response was not valid JSON. The task will be blocked until a valid review passes.",
				),
				rawResponse,
			}
		}

		const summary = this.ensureString(parsed.summary)
		const findings = this.ensureStringArray(parsed.findings, MAX_FINDINGS)
		const risks = this.ensureStringArray(parsed.risks, MAX_RISKS)

		const rawScore = typeof parsed.score === "number" ? parsed.score : 5
		const score = Math.max(1, Math.min(10, Math.round(rawScore)))

		const issues: RpiCodeReviewIssue[] = []
		const severityMap: [string, RpiCodeReviewIssue["severity"]][] = [
			["criticalIssues", "critical"],
			["majorIssues", "major"],
			["minorIssues", "minor"],
		]

		for (const [key, severity] of severityMap) {
			const arr = parsed[key]
			if (!Array.isArray(arr)) {
				continue
			}
			for (const item of arr) {
				if (!item || typeof item !== "object") {
					continue
				}
				const issue = item as Record<string, unknown>
				issues.push({
					severity,
					category: typeof issue.category === "string" ? issue.category : "General",
					description:
						typeof issue.description === "string" ? issue.description : String(issue.description ?? ""),
					file: typeof issue.file === "string" ? issue.file : undefined,
					suggestion: typeof issue.suggestion === "string" ? issue.suggestion : undefined,
				})
			}
		}

		const reviewMarkdown = this.formatReviewMarkdown(score, issues, summary || "Code review completed.")

		return {
			summary: summary || "Code review completed.",
			score,
			issues,
			findings,
			risks,
			reviewMarkdown,
			rawResponse,
		}
	}

	private formatReviewMarkdown(score: number, issues: RpiCodeReviewIssue[], summary: string): string {
		const statusLabel = score >= 7 ? "OK" : score >= 4 ? "WARN" : "FAIL"
		const lines: string[] = [`## Code Review — Score: ${score}/10 [${statusLabel}]`, "", summary]

		const critical = issues.filter((i) => i.severity === "critical")
		const major = issues.filter((i) => i.severity === "major")
		const minor = issues.filter((i) => i.severity === "minor")

		if (critical.length > 0) {
			lines.push("", "### Critical Issues")
			for (const issue of critical) {
				lines.push(`- **[${issue.category}]** ${issue.description}`)
				if (issue.file) {
					lines.push(`  File: \`${issue.file}\``)
				}
				if (issue.suggestion) {
					lines.push(`  Fix: ${issue.suggestion}`)
				}
			}
		}

		if (major.length > 0) {
			lines.push("", "### Major Issues")
			for (const issue of major) {
				lines.push(`- **[${issue.category}]** ${issue.description}`)
				if (issue.file) {
					lines.push(`  File: \`${issue.file}\``)
				}
				if (issue.suggestion) {
					lines.push(`  Fix: ${issue.suggestion}`)
				}
			}
		}

		if (minor.length > 0) {
			lines.push("", "### Minor Issues")
			for (const issue of minor) {
				lines.push(`- [${issue.category}] ${issue.description}`)
				if (issue.file) {
					lines.push(`  File: \`${issue.file}\``)
				}
				if (issue.suggestion) {
					lines.push(`  Fix: ${issue.suggestion}`)
				}
			}
		}

		if (issues.length === 0) {
			lines.push("", "No issues found.")
		}

		return lines.join("\n")
	}

	private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
		if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
			return promise
		}

		let timeoutId: NodeJS.Timeout | undefined
		const timeoutPromise = new Promise<never>((_, reject) => {
			timeoutId = setTimeout(() => {
				reject(new Error(message))
			}, timeoutMs)
		})

		return Promise.race([promise, timeoutPromise]).finally(() => {
			if (timeoutId) {
				clearTimeout(timeoutId)
			}
		})
	}
}
