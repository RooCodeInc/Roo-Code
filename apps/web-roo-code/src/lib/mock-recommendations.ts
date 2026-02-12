// ---------------------------------------------------------------------------
// Eval Recommendations: Types + Mock Data (S1.1a)
// ---------------------------------------------------------------------------
// This file defines the API contract for the /evals/workers recommendation pages.
// The backend (Sprint 3-4) will produce data matching these exact types.
// ---------------------------------------------------------------------------

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * Estimated tasks per agent per day.
 * Assumes ~6 productive hours with overhead for setup, review, and iteration.
 * One human engineer typically manages 2-3 agents throughout a workday.
 */
export const TASKS_PER_DAY = 80

// ── Types ──────────────────────────────────────────────────────────────────

/** Engineer role definition: maps task complexity to a recommendation tier. */
export type EngineerRole = {
	id: string
	name: string
	/** Short descriptor shown under the profile name (scope, mode, etc.). */
	salaryRange: string
	description: string
	bestFor: string[]
	strengths: string[]
	weaknesses: string[]
	icon: string
}

/** Language-specific eval scores (0–100). */
export type LanguageScores = {
	go: number
	java: number
	javascript: number
	python: number
	rust: number
}

/** Model inference settings used during evaluation. */
export type ModelSettings = {
	temperature: number
	reasoningEffort?: string
}

/** A model candidate evaluated for a specific role. */
export type ModelCandidate = {
	provider: string
	modelId: string
	displayName: string
	compositeScore: number
	tier: "best" | "recommended" | "situational" | "not-recommended"
	tags: string[]
	successRate: number
	avgCostPerTask: number
	/** Estimated daily cost: avgCostPerTask × TASKS_PER_DAY */
	estimatedDailyCost: number
	avgTimePerTask: number
	languageScores: LanguageScores
	settings: ModelSettings
	caveats?: string[]
}

/** Full recommendation payload for a single role. */
export type RoleRecommendation = {
	roleId: string
	role: EngineerRole
	lastUpdated: string
	totalEvalRuns: number
	totalExercises: number
	best: ModelCandidate[]
	budgetHire: ModelCandidate | null
	speedHire: ModelCandidate | null
	allCandidates: ModelCandidate[]
}

// ── Engineer Role Configs ──────────────────────────────────────────────────

const ENGINEER_ROLES: EngineerRole[] = [
	{
		id: "junior",
		name: "Single-file Builder",
		salaryRange: "Scope: single-file",
		description:
			"Best for tight diffs: boilerplate, small fixes, and test updates. Great when the work is clear and bounded.",
		bestFor: ["Small fixes", "Boilerplate", "Test updates", "Simple implementations"],
		strengths: ["Fast iteration", "Stays close to the requested change", "Great for well-scoped diffs"],
		weaknesses: ["Not ideal for cross-cutting work", "Can miss edge cases in complex systems"],
		icon: "Code",
	},
	{
		id: "senior",
		name: "Multi-file Builder",
		salaryRange: "Scope: multi-file",
		description:
			"For most day-to-day shipping: feature work across a few files, refactors, and debugging with solid consistency.",
		bestFor: ["Feature work", "Multi-file refactors", "Debugging", "Integrations"],
		strengths: [
			"Reliable for common product work",
			"Handles multi-file changes and dependencies",
			"Consistent across all five languages",
		],
		weaknesses: ["Overkill for trivial diffs", "May need help on cross-cutting architecture"],
		icon: "GitBranch",
	},
	{
		id: "staff",
		name: "Architecture & Refactor",
		salaryRange: "Scope: cross-cutting",
		description:
			"For ambiguity and cross-cutting changes: architecture decisions, complex refactors, and work where correctness matters more than speed.",
		bestFor: ["Complex refactors", "Architecture changes", "Ambiguous requirements", "System design"],
		strengths: [
			"Strong multi-step reasoning",
			"Good at navigating bigger codebases",
			"Better at making safe, coherent changes",
		],
		weaknesses: ["Overkill for simple diffs", "Still needs human review before merge"],
		icon: "Building2",
	},
	{
		id: "reviewer",
		name: "Reviewer & Guardrails",
		salaryRange: "Mode: review",
		description:
			"For PR feedback, security review, and design critique. Use this to improve quality and reduce surprises before merge.",
		bestFor: ["Code review", "PR feedback", "Security analysis", "Design critique", "Refactor guidance"],
		strengths: [
			"Catches subtle bugs and logic errors",
			"Provides actionable suggestions with context",
			"Understands cross-file impact of changes",
		],
		weaknesses: [
			"Not for writing features end-to-end",
			"Not a replacement for CI and linters",
			"Review quality varies by codebase size",
		],
		icon: "Search",
	},
	{
		id: "autonomous",
		name: "Autonomous Delivery",
		salaryRange: "Mode: end-to-end",
		description:
			"For issue-to-PR workflows and long-running tasks. Best when you want an agent to run, iterate, and bring back a reviewable result.",
		bestFor: [
			"Issue-to-PR workflows",
			"Multi-step debugging",
			"Feature implementation from spec",
			"Long-running tasks",
			"Batch operations",
		],
		strengths: [
			"Completes tasks end-to-end with minimal guidance",
			"Recovers from errors and retries automatically",
			"Handles ambiguous requirements independently",
		],
		weaknesses: [
			"Higher cost per completed task due to retries",
			"May take unexpected approaches without oversight",
			"Results need review before merging",
		],
		icon: "Bot",
	},
]

// ── Model Candidates (derived from roocode.com/evals data) ─────────────────
// Cost per task = total run cost ÷ 120 exercises
// Time per task = total duration (seconds) ÷ 120 exercises
// Composite scores computed using role-specific weights:
//   Junior: success 50%, speed 20%, cost 25%, quality 5%
//   Senior: success 40%, quality 25%, cost 20%, speed 15%
//   Staff:  success 40%, quality 35%, cost 15%, speed 10%
// Quality = consistency across languages (lower variance → higher score)

// --- Junior Role Candidates -------------------------------------------------

const juniorCandidates: ModelCandidate[] = [
	{
		provider: "xai",
		modelId: "grok-4-fast",
		displayName: "Grok 4 Fast",
		compositeScore: 94,
		tier: "best",
		tags: ["best-value"],
		successRate: 97,
		avgCostPerTask: 0.029,
		estimatedDailyCost: 0.029 * TASKS_PER_DAY,
		avgTimePerTask: 144.0,
		languageScores: { go: 97, java: 96, javascript: 98, python: 100, rust: 97 },
		settings: { temperature: 0 },
	},
	{
		provider: "openai",
		modelId: "gpt-5-mini",
		displayName: "GPT-5 Mini",
		compositeScore: 92,
		tier: "best",
		tags: [],
		successRate: 99,
		avgCostPerTask: 0.028,
		estimatedDailyCost: 0.028 * TASKS_PER_DAY,
		avgTimePerTask: 173.0,
		languageScores: { go: 100, java: 98, javascript: 100, python: 100, rust: 97 },
		settings: { temperature: 0 },
	},
	{
		provider: "xai",
		modelId: "grok-code-fast-1",
		displayName: "Grok Code Fast 1",
		compositeScore: 85,
		tier: "best",
		tags: [],
		successRate: 90,
		avgCostPerTask: 0.057,
		estimatedDailyCost: 0.057 * TASKS_PER_DAY,
		avgTimePerTask: 146.0,
		languageScores: { go: 92, java: 91, javascript: 88, python: 94, rust: 83 },
		settings: { temperature: 0 },
		caveats: ["Weaker on Rust (83%): consider alternatives for Rust-heavy tasks"],
	},
	{
		provider: "google",
		modelId: "gemini-2.5-flash",
		displayName: "Gemini 2.5 Flash",
		compositeScore: 82,
		tier: "recommended",
		tags: ["speed-hire"],
		successRate: 90,
		avgCostPerTask: 0.118,
		estimatedDailyCost: 0.118 * TASKS_PER_DAY,
		avgTimePerTask: 109.5,
		languageScores: { go: 89, java: 91, javascript: 92, python: 85, rust: 90 },
		settings: { temperature: 0 },
	},
	{
		provider: "openai",
		modelId: "gpt-4.1-mini",
		displayName: "GPT-4.1 Mini",
		compositeScore: 77,
		tier: "recommended",
		tags: [],
		successRate: 83,
		avgCostPerTask: 0.073,
		estimatedDailyCost: 0.073 * TASKS_PER_DAY,
		avgTimePerTask: 158.5,
		languageScores: { go: 81, java: 84, javascript: 94, python: 76, rust: 70 },
		settings: { temperature: 0 },
		caveats: ["Inconsistent across languages: Python (76%) to JavaScript (94%)"],
	},
	{
		provider: "anthropic",
		modelId: "claude-haiku-4-5",
		displayName: "Claude Haiku 4.5",
		compositeScore: 77,
		tier: "recommended",
		tags: [],
		successRate: 95,
		avgCostPerTask: 0.159,
		estimatedDailyCost: 0.159 * TASKS_PER_DAY,
		avgTimePerTask: 139.0,
		languageScores: { go: 92, java: 93, javascript: 94, python: 97, rust: 100 },
		settings: { temperature: 0 },
		caveats: ["Most expensive in junior tier. Consider Grok 4 Fast for better cost-to-quality ratio."],
	},
	{
		provider: "openai",
		modelId: "gpt-5-nano",
		displayName: "GPT-5 Nano",
		compositeScore: 73,
		tier: "situational",
		tags: ["budget-hire"],
		successRate: 78,
		avgCostPerTask: 0.013,
		estimatedDailyCost: 0.013 * TASKS_PER_DAY,
		avgTimePerTask: 276.5,
		languageScores: { go: 86, java: 73, javascript: 76, python: 79, rust: 77 },
		settings: { temperature: 0 },
		caveats: ["Cheapest option but slowest: 4.6 min/task average"],
	},
	{
		provider: "deepseek",
		modelId: "deepseek-v3",
		displayName: "DeepSeek V3",
		compositeScore: 66,
		tier: "situational",
		tags: [],
		successRate: 77,
		avgCostPerTask: 0.107,
		estimatedDailyCost: 0.107 * TASKS_PER_DAY,
		avgTimePerTask: 216.0,
		languageScores: { go: 83, java: 76, javascript: 82, python: 76, rust: 67 },
		settings: { temperature: 0 },
		caveats: ["Weakest on Rust (67%)", "Open-source model, self-hostable"],
	},
]

// --- Senior Role Candidates -------------------------------------------------

const seniorCandidates: ModelCandidate[] = [
	{
		provider: "moonshot",
		modelId: "kimi-k2-0905",
		displayName: "Kimi K2 0905",
		compositeScore: 95,
		tier: "best",
		tags: ["budget-hire", "best-value"],
		successRate: 94,
		avgCostPerTask: 0.127,
		estimatedDailyCost: 0.127 * TASKS_PER_DAY,
		avgTimePerTask: 112.0,
		languageScores: { go: 94, java: 91, javascript: 96, python: 97, rust: 93 },
		settings: { temperature: 0 },
		caveats: ["Tested via Groq; latency may vary by provider"],
	},
	{
		provider: "openai",
		modelId: "gpt-4.1",
		displayName: "GPT-4.1",
		compositeScore: 87,
		tier: "best",
		tags: [],
		successRate: 91,
		avgCostPerTask: 0.322,
		estimatedDailyCost: 0.322 * TASKS_PER_DAY,
		avgTimePerTask: 139.5,
		languageScores: { go: 92, java: 91, javascript: 90, python: 94, rust: 90 },
		settings: { temperature: 0 },
	},
	{
		provider: "anthropic",
		modelId: "claude-sonnet-4",
		displayName: "Claude Sonnet 4",
		compositeScore: 84,
		tier: "best",
		tags: ["top-performer"],
		successRate: 98,
		avgCostPerTask: 0.33,
		estimatedDailyCost: 0.33 * TASKS_PER_DAY,
		avgTimePerTask: 167.5,
		languageScores: { go: 94, java: 100, javascript: 98, python: 100, rust: 97 },
		settings: { temperature: 0 },
	},
	{
		provider: "openai",
		modelId: "gpt-5-medium",
		displayName: "GPT-5 (Medium)",
		compositeScore: 81,
		tier: "recommended",
		tags: [],
		successRate: 98,
		avgCostPerTask: 0.193,
		estimatedDailyCost: 0.193 * TASKS_PER_DAY,
		avgTimePerTask: 260.0,
		languageScores: { go: 97, java: 98, javascript: 100, python: 100, rust: 93 },
		settings: { temperature: 0, reasoningEffort: "medium" },
		caveats: ["Slowest in tier: 4.3 min/task average"],
	},
	{
		provider: "anthropic",
		modelId: "claude-3.7-sonnet",
		displayName: "Claude 3.7 Sonnet",
		compositeScore: 79,
		tier: "recommended",
		tags: [],
		successRate: 95,
		avgCostPerTask: 0.313,
		estimatedDailyCost: 0.313 * TASKS_PER_DAY,
		avgTimePerTask: 176.5,
		languageScores: { go: 92, java: 98, javascript: 94, python: 100, rust: 93 },
		settings: { temperature: 0 },
	},
	{
		provider: "anthropic",
		modelId: "claude-3.5-sonnet",
		displayName: "Claude 3.5 Sonnet",
		compositeScore: 78,
		tier: "recommended",
		tags: ["speed-hire"],
		successRate: 90,
		avgCostPerTask: 0.208,
		estimatedDailyCost: 0.208 * TASKS_PER_DAY,
		avgTimePerTask: 108.5,
		languageScores: { go: 94, java: 91, javascript: 92, python: 88, rust: 80 },
		settings: { temperature: 0 },
		caveats: ["Previous generation; weaker on Rust (80%)"],
	},
	{
		provider: "openai",
		modelId: "gpt-5-low",
		displayName: "GPT-5 (Low)",
		compositeScore: 76,
		tier: "situational",
		tags: [],
		successRate: 95,
		avgCostPerTask: 0.135,
		estimatedDailyCost: 0.135 * TASKS_PER_DAY,
		avgTimePerTask: 175.0,
		languageScores: { go: 100, java: 96, javascript: 86, python: 100, rust: 100 },
		settings: { temperature: 0, reasoningEffort: "low" },
		caveats: ["Weak on JavaScript (86%) compared to other languages"],
	},
	{
		provider: "google",
		modelId: "gemini-2.5-pro",
		displayName: "Gemini 2.5 Pro",
		compositeScore: 73,
		tier: "situational",
		tags: [],
		successRate: 96,
		avgCostPerTask: 0.482,
		estimatedDailyCost: 0.482 * TASKS_PER_DAY,
		avgTimePerTask: 188.5,
		languageScores: { go: 97, java: 91, javascript: 96, python: 100, rust: 97 },
		settings: { temperature: 0 },
		caveats: ["Most expensive in this tier: $39/day ($0.48/task)"],
	},
]

// --- Staff Role Candidates --------------------------------------------------

const staffCandidates: ModelCandidate[] = [
	{
		provider: "openai",
		modelId: "gpt-5.2-med",
		displayName: "GPT 5.2 (Med)",
		compositeScore: 99,
		tier: "best",
		tags: ["budget-hire", "best-value"],
		successRate: 100,
		avgCostPerTask: 0.104,
		estimatedDailyCost: 0.104 * TASKS_PER_DAY,
		avgTimePerTask: 105.5,
		languageScores: { go: 100, java: 100, javascript: 100, python: 100, rust: 100 },
		settings: { temperature: 0, reasoningEffort: "medium" },
		caveats: ["100% pass rate at $8/day ($0.10/task): best cost-to-quality ratio in this role"],
	},
	{
		provider: "anthropic",
		modelId: "claude-opus-4-6",
		displayName: "Claude Opus 4.6",
		compositeScore: 98,
		tier: "best",
		tags: ["speed-hire", "top-performer"],
		successRate: 100,
		avgCostPerTask: 0.412,
		estimatedDailyCost: 0.412 * TASKS_PER_DAY,
		avgTimePerTask: 76.5,
		languageScores: { go: 100, java: 100, javascript: 100, python: 100, rust: 100 },
		settings: { temperature: 0 },
	},
	{
		provider: "anthropic",
		modelId: "claude-sonnet-4-5",
		displayName: "Claude Sonnet 4.5",
		compositeScore: 97,
		tier: "best",
		tags: [],
		successRate: 100,
		avgCostPerTask: 0.32,
		estimatedDailyCost: 0.32 * TASKS_PER_DAY,
		avgTimePerTask: 103.0,
		languageScores: { go: 100, java: 100, javascript: 100, python: 100, rust: 100 },
		settings: { temperature: 0 },
	},
	{
		provider: "anthropic",
		modelId: "claude-opus-4-5",
		displayName: "Claude Opus 4.5",
		compositeScore: 96,
		tier: "recommended",
		tags: [],
		successRate: 100,
		avgCostPerTask: 0.419,
		estimatedDailyCost: 0.419 * TASKS_PER_DAY,
		avgTimePerTask: 124.0,
		languageScores: { go: 100, java: 100, javascript: 100, python: 100, rust: 100 },
		settings: { temperature: 0 },
	},
	{
		provider: "google",
		modelId: "gemini-3-pro-preview",
		displayName: "Gemini 3 Pro Preview",
		compositeScore: 95,
		tier: "recommended",
		tags: [],
		successRate: 100,
		avgCostPerTask: 0.276,
		estimatedDailyCost: 0.276 * TASKS_PER_DAY,
		avgTimePerTask: 164.0,
		languageScores: { go: 100, java: 100, javascript: 100, python: 100, rust: 100 },
		settings: { temperature: 0 },
	},
	{
		provider: "anthropic",
		modelId: "claude-opus-4-1",
		displayName: "Claude Opus 4.1",
		compositeScore: 73,
		tier: "situational",
		tags: [],
		successRate: 98,
		avgCostPerTask: 1.168,
		estimatedDailyCost: 1.168 * TASKS_PER_DAY,
		avgTimePerTask: 211.5,
		languageScores: { go: 97, java: 96, javascript: 98, python: 100, rust: 100 },
		settings: { temperature: 0 },
		caveats: ["$93/day ($1.17/task), 11× the cost of the top pick"],
	},
	{
		provider: "openai",
		modelId: "gpt-5-medium",
		displayName: "GPT-5 (Medium)",
		compositeScore: 71,
		tier: "situational",
		tags: [],
		successRate: 98,
		avgCostPerTask: 0.193,
		estimatedDailyCost: 0.193 * TASKS_PER_DAY,
		avgTimePerTask: 260.0,
		languageScores: { go: 97, java: 98, javascript: 100, python: 100, rust: 93 },
		settings: { temperature: 0, reasoningEffort: "medium" },
		caveats: ["Slowest in tier: 4.3 min/task average"],
	},
	{
		provider: "anthropic",
		modelId: "claude-opus-4",
		displayName: "Claude Opus 4",
		compositeScore: 57,
		tier: "not-recommended",
		tags: [],
		successRate: 94,
		avgCostPerTask: 1.436,
		estimatedDailyCost: 1.436 * TASKS_PER_DAY,
		avgTimePerTask: 235.0,
		languageScores: { go: 92, java: 91, javascript: 94, python: 94, rust: 100 },
		settings: { temperature: 0 },
		caveats: [
			"Most expensive model tested: $115/day ($1.44/task)",
			"Lower success rate (94%) despite highest cost",
		],
	},
]

// --- Architecture Reviewer Candidates ---------------------------------------
// Composite scoring: quality 50%, success 30%, cost 15%, speed 5%
// Quality = consistency across languages (lower variance → higher score)

const reviewerCandidates: ModelCandidate[] = [
	{
		provider: "openai",
		modelId: "gpt-5.2-med",
		displayName: "GPT 5.2 (Med)",
		compositeScore: 98,
		tier: "best",
		tags: ["budget-hire", "best-value"],
		successRate: 100,
		avgCostPerTask: 0.104,
		estimatedDailyCost: 0.104 * TASKS_PER_DAY,
		avgTimePerTask: 105.5,
		languageScores: { go: 100, java: 100, javascript: 100, python: 100, rust: 100 },
		settings: { temperature: 0, reasoningEffort: "medium" },
		caveats: ["100% consistency across all languages: ideal reviewer at $8/day"],
	},
	{
		provider: "anthropic",
		modelId: "claude-opus-4-6",
		displayName: "Claude Opus 4.6",
		compositeScore: 95,
		tier: "best",
		tags: ["speed-hire", "top-performer"],
		successRate: 100,
		avgCostPerTask: 0.412,
		estimatedDailyCost: 0.412 * TASKS_PER_DAY,
		avgTimePerTask: 76.5,
		languageScores: { go: 100, java: 100, javascript: 100, python: 100, rust: 100 },
		settings: { temperature: 0 },
	},
	{
		provider: "anthropic",
		modelId: "claude-sonnet-4-5",
		displayName: "Claude Sonnet 4.5",
		compositeScore: 94,
		tier: "best",
		tags: [],
		successRate: 100,
		avgCostPerTask: 0.32,
		estimatedDailyCost: 0.32 * TASKS_PER_DAY,
		avgTimePerTask: 103.0,
		languageScores: { go: 100, java: 100, javascript: 100, python: 100, rust: 100 },
		settings: { temperature: 0 },
	},
	{
		provider: "anthropic",
		modelId: "claude-sonnet-4",
		displayName: "Claude Sonnet 4",
		compositeScore: 90,
		tier: "recommended",
		tags: ["top-performer"],
		successRate: 98,
		avgCostPerTask: 0.33,
		estimatedDailyCost: 0.33 * TASKS_PER_DAY,
		avgTimePerTask: 167.5,
		languageScores: { go: 94, java: 100, javascript: 98, python: 100, rust: 97 },
		settings: { temperature: 0 },
	},
	{
		provider: "anthropic",
		modelId: "claude-haiku-4-5",
		displayName: "Claude Haiku 4.5",
		compositeScore: 88,
		tier: "recommended",
		tags: [],
		successRate: 95,
		avgCostPerTask: 0.159,
		estimatedDailyCost: 0.159 * TASKS_PER_DAY,
		avgTimePerTask: 139.0,
		languageScores: { go: 92, java: 93, javascript: 94, python: 97, rust: 100 },
		settings: { temperature: 0 },
		caveats: ["Budget reviewer option: good consistency at lower cost"],
	},
	{
		provider: "anthropic",
		modelId: "claude-3.7-sonnet",
		displayName: "Claude 3.7 Sonnet",
		compositeScore: 86,
		tier: "recommended",
		tags: [],
		successRate: 95,
		avgCostPerTask: 0.313,
		estimatedDailyCost: 0.313 * TASKS_PER_DAY,
		avgTimePerTask: 176.5,
		languageScores: { go: 92, java: 98, javascript: 94, python: 100, rust: 93 },
		settings: { temperature: 0 },
	},
	{
		provider: "google",
		modelId: "gemini-2.5-pro",
		displayName: "Gemini 2.5 Pro",
		compositeScore: 82,
		tier: "situational",
		tags: [],
		successRate: 96,
		avgCostPerTask: 0.482,
		estimatedDailyCost: 0.482 * TASKS_PER_DAY,
		avgTimePerTask: 188.5,
		languageScores: { go: 97, java: 91, javascript: 96, python: 100, rust: 97 },
		settings: { temperature: 0 },
		caveats: ["Most expensive reviewer: $39/day ($0.48/task)", "More variable across languages than top picks"],
	},
	{
		provider: "openai",
		modelId: "gpt-4.1",
		displayName: "GPT-4.1",
		compositeScore: 80,
		tier: "situational",
		tags: [],
		successRate: 91,
		avgCostPerTask: 0.322,
		estimatedDailyCost: 0.322 * TASKS_PER_DAY,
		avgTimePerTask: 139.5,
		languageScores: { go: 92, java: 91, javascript: 90, python: 94, rust: 90 },
		settings: { temperature: 0 },
		caveats: ["Lower consistency across languages than Anthropic alternatives"],
	},
]

// --- Autonomous Agent Candidates --------------------------------------------
// Composite scoring: success 35%, quality 35%, cost 20%, speed 10%
// Focused on end-to-end task completion and error recovery

const autonomousCandidates: ModelCandidate[] = [
	{
		provider: "openai",
		modelId: "gpt-5.2-med",
		displayName: "GPT 5.2 (Med)",
		compositeScore: 97,
		tier: "best",
		tags: ["best-value", "speed-hire"],
		successRate: 100,
		avgCostPerTask: 0.104,
		estimatedDailyCost: 0.104 * TASKS_PER_DAY,
		avgTimePerTask: 105.5,
		languageScores: { go: 100, java: 100, javascript: 100, python: 100, rust: 100 },
		settings: { temperature: 0, reasoningEffort: "medium" },
		caveats: ["Perfect success rate + fast completion: ideal autonomous agent at $8/day"],
	},
	{
		provider: "openai",
		modelId: "gpt-5-mini",
		displayName: "GPT-5 Mini",
		compositeScore: 93,
		tier: "best",
		tags: ["budget-hire"],
		successRate: 99,
		avgCostPerTask: 0.028,
		estimatedDailyCost: 0.028 * TASKS_PER_DAY,
		avgTimePerTask: 173.0,
		languageScores: { go: 100, java: 98, javascript: 100, python: 100, rust: 97 },
		settings: { temperature: 0 },
		caveats: ["Cheapest autonomous option at $2/day with near-perfect success"],
	},
	{
		provider: "xai",
		modelId: "grok-4-fast",
		displayName: "Grok 4 Fast",
		compositeScore: 92,
		tier: "best",
		tags: [],
		successRate: 97,
		avgCostPerTask: 0.029,
		estimatedDailyCost: 0.029 * TASKS_PER_DAY,
		avgTimePerTask: 144.0,
		languageScores: { go: 97, java: 96, javascript: 98, python: 100, rust: 97 },
		settings: { temperature: 0 },
	},
	{
		provider: "anthropic",
		modelId: "claude-sonnet-4",
		displayName: "Claude Sonnet 4",
		compositeScore: 87,
		tier: "recommended",
		tags: ["top-performer"],
		successRate: 98,
		avgCostPerTask: 0.33,
		estimatedDailyCost: 0.33 * TASKS_PER_DAY,
		avgTimePerTask: 167.5,
		languageScores: { go: 94, java: 100, javascript: 98, python: 100, rust: 97 },
		settings: { temperature: 0 },
	},
	{
		provider: "moonshot",
		modelId: "kimi-k2-0905",
		displayName: "Kimi K2 0905",
		compositeScore: 86,
		tier: "recommended",
		tags: [],
		successRate: 94,
		avgCostPerTask: 0.127,
		estimatedDailyCost: 0.127 * TASKS_PER_DAY,
		avgTimePerTask: 112.0,
		languageScores: { go: 94, java: 91, javascript: 96, python: 97, rust: 93 },
		settings: { temperature: 0 },
		caveats: ["Tested via Groq; latency may vary by provider"],
	},
	{
		provider: "anthropic",
		modelId: "claude-haiku-4-5",
		displayName: "Claude Haiku 4.5",
		compositeScore: 85,
		tier: "recommended",
		tags: [],
		successRate: 95,
		avgCostPerTask: 0.159,
		estimatedDailyCost: 0.159 * TASKS_PER_DAY,
		avgTimePerTask: 139.0,
		languageScores: { go: 92, java: 93, javascript: 94, python: 97, rust: 100 },
		settings: { temperature: 0 },
	},
	{
		provider: "openai",
		modelId: "gpt-5-low",
		displayName: "GPT-5 (Low)",
		compositeScore: 82,
		tier: "situational",
		tags: [],
		successRate: 95,
		avgCostPerTask: 0.135,
		estimatedDailyCost: 0.135 * TASKS_PER_DAY,
		avgTimePerTask: 175.0,
		languageScores: { go: 100, java: 96, javascript: 86, python: 100, rust: 100 },
		settings: { temperature: 0, reasoningEffort: "low" },
		caveats: ["Weak on JavaScript (86%) compared to other languages"],
	},
	{
		provider: "openai",
		modelId: "gpt-5-medium",
		displayName: "GPT-5 (Medium)",
		compositeScore: 80,
		tier: "situational",
		tags: [],
		successRate: 98,
		avgCostPerTask: 0.193,
		estimatedDailyCost: 0.193 * TASKS_PER_DAY,
		avgTimePerTask: 260.0,
		languageScores: { go: 97, java: 98, javascript: 100, python: 100, rust: 93 },
		settings: { temperature: 0, reasoningEffort: "medium" },
		caveats: ["Slowest in tier: 4.3 min/task average"],
	},
]

// ── Recommendation Builders ────────────────────────────────────────────────

function findBudgetHire(candidates: ModelCandidate[]): ModelCandidate | null {
	const budget = candidates
		.filter((c) => c.tags.includes("budget-hire"))
		.sort((a, b) => a.avgCostPerTask - b.avgCostPerTask)
	return budget[0] ?? null
}

function findSpeedHire(candidates: ModelCandidate[]): ModelCandidate | null {
	const fast = [...candidates]
		.filter((c) => c.tier !== "not-recommended")
		.sort((a, b) => a.avgTimePerTask - b.avgTimePerTask)
	return fast[0] ?? null
}

function buildRecommendation(
	role: EngineerRole,
	candidates: ModelCandidate[],
	totalEvalRuns: number,
	totalExercises: number,
): RoleRecommendation {
	const sorted = [...candidates].sort((a, b) => b.compositeScore - a.compositeScore)
	return {
		roleId: role.id,
		role,
		lastUpdated: "2026-02-11T00:00:00Z",
		totalEvalRuns,
		totalExercises,
		best: sorted.filter((c) => c.tier === "best").slice(0, 3),
		budgetHire: findBudgetHire(sorted),
		speedHire: findSpeedHire(sorted),
		allCandidates: sorted,
	}
}

// ── Pre-built Recommendations ──────────────────────────────────────────────

const RECOMMENDATIONS: Record<string, RoleRecommendation> = {
	junior: buildRecommendation(ENGINEER_ROLES[0]!, juniorCandidates, 27, 120),
	senior: buildRecommendation(ENGINEER_ROLES[1]!, seniorCandidates, 27, 120),
	staff: buildRecommendation(ENGINEER_ROLES[2]!, staffCandidates, 27, 120),
	reviewer: buildRecommendation(ENGINEER_ROLES[3]!, reviewerCandidates, 27, 120),
	autonomous: buildRecommendation(ENGINEER_ROLES[4]!, autonomousCandidates, 27, 120),
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Returns all engineer role configurations. */
export function getEngineerRoles(): EngineerRole[] {
	return ENGINEER_ROLES
}

/** Returns a single engineer role by id, or `undefined` if not found. */
export function getEngineerRole(roleId: string): EngineerRole | undefined {
	return ENGINEER_ROLES.find((r) => r.id === roleId)
}

/** Returns the full recommendation payload for a role, or `undefined` if not found. */
export function getRoleRecommendation(roleId: string): RoleRecommendation | undefined {
	return RECOMMENDATIONS[roleId]
}

/** Returns recommendation payloads for all roles. */
export function getAllRecommendations(): RoleRecommendation[] {
	return Object.values(RECOMMENDATIONS)
}

/** Generates a Cloud signup URL pre-configured with the candidate's model settings. */
export function getCloudSetupUrl(candidate: ModelCandidate): string {
	const params = new URLSearchParams({
		redirect_url: `/cloud-agents/setup?model=${candidate.modelId}&provider=${candidate.provider}&temperature=${candidate.settings.temperature}`,
	})
	return `https://app.roocode.com/sign-up?${params.toString()}`
}

// ── Model Timeline Data ────────────────────────────────────────────────────
// Historical model performance over time for the landing page chart.

export type ModelTimelineEntry = {
	modelName: string
	provider: string
	releaseDate: string // ISO date
	score: number // our eval score (total %)
	costPerRun: number // total cost for the full eval run
}

export const MODEL_TIMELINE: ModelTimelineEntry[] = [
	{ modelName: "Claude 3.5 Sonnet", provider: "anthropic", releaseDate: "2025-06-20", score: 90, costPerRun: 24.98 },
	{ modelName: "GPT-4.1", provider: "openai", releaseDate: "2025-08-14", score: 91, costPerRun: 38.64 },
	{ modelName: "Claude 3.7 Sonnet", provider: "anthropic", releaseDate: "2025-09-15", score: 95, costPerRun: 37.58 },
	{ modelName: "Gemini 2.5 Pro", provider: "google", releaseDate: "2025-10-01", score: 96, costPerRun: 57.8 },
	{ modelName: "Claude Sonnet 4", provider: "anthropic", releaseDate: "2025-11-01", score: 98, costPerRun: 39.61 },
	{ modelName: "GPT-5 Mini", provider: "openai", releaseDate: "2025-12-01", score: 99, costPerRun: 3.34 },
	{ modelName: "Claude Sonnet 4.5", provider: "anthropic", releaseDate: "2026-01-15", score: 100, costPerRun: 38.43 },
	{ modelName: "GPT 5.2 (Med)", provider: "openai", releaseDate: "2026-01-20", score: 100, costPerRun: 12.5 },
	{ modelName: "Claude Opus 4.6", provider: "anthropic", releaseDate: "2026-02-01", score: 100, costPerRun: 49.48 },
	{ modelName: "Gemini 3 Pro", provider: "google", releaseDate: "2026-02-05", score: 100, costPerRun: 33.06 },
]
