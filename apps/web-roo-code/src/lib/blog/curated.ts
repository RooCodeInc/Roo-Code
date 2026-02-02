/**
 * Curated blog posts configuration
 *
 * These 24 posts are strategically selected to align with Roo Code's positioning:
 * - Sessions: iterate before PR, PRs with proof
 * - Cloud Agents: remote execution, multi-surface
 * - Modes + Orchestrator: AI managing AI
 * - BYOK: bring your own key ecosystem
 * - Token philosophy: spend to get quality
 * - Enterprise: Series A-C teams
 */

/**
 * Curated post slugs in display order (strategic priority)
 *
 * TIER 1: Core Canon Alignment
 * TIER 2: Enterprise & Partnerships
 * TIER 3: Product Features & Direction
 * TIER 4: Model Landscape
 */
export const CURATED_POST_SLUGS = [
	// TIER 1: Core Canon Alignment (8 posts)
	"orgdesign-your-ai-modes-like-you-would-a-team",
	"treat-every-issue-as-a-remote-agent-job-and-collect-partial-credit",
	"nonengineers-stopped-waiting-for-engineers-to-unblock-them",
	"bug-fixes-as-beach-trash-pickup",
	"codebase-indexing-beats-memory-banks-because-summaries-drift",
	"when-your-evals-hit-99-the-problem-is-the-eval",
	"score-agents-like-employees-not-like-models",
	"a-readiness-checklist-predicts-ai-agent-success-before-you-start",

	// TIER 2: Enterprise & Partnerships (6 posts)
	"measure-aptitude-before-you-measure-productivity",
	"why-10-million-token-context-windows-arent-available-yet",
	"why-your-2023-llm-integration-needs-a-rewrite",
	"ai-best-practices-spread-through-internal-influencers-not-topdown-mandates",
	"manage-ai-spend-by-measuring-return-not-cost",
	"prescriptive-beats-exploratory-for-teamwide-ai-adoption",

	// TIER 3: Product Features & Direction (6 posts)
	"boomerang-task-orchestration-hides-context-and-that-confuses-users",
	"a-mode-that-asks-questions-eliminates-prompt-engineering",
	"todo-lists-keep-agents-running-for-45-minutes-without-failure",
	"semantic-search-finds-what-grep-misses",
	"mcp-tool-descriptions-need-when-to-use-instructions",
	"orchestrator-mode-backfires-on-simple-tasks",

	// TIER 4: Model Landscape (4 posts)
	"match-the-agent-to-the-task-not-the-brand",
	"local-models-work-for-edits-not-for-oneshots",
	"the-opus-cost-paradox-expensive-models-can-be-cheaper",
	"tool-call-reliability-is-the-real-model-differentiator",
] as const

export type CuratedPostSlug = (typeof CURATED_POST_SLUGS)[number]

/**
 * Check if a slug is in the curated list
 */
export function isCuratedPost(slug: string): boolean {
	return CURATED_POST_SLUGS.includes(slug as CuratedPostSlug)
}
