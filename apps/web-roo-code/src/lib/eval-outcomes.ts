import type { LucideIcon } from "lucide-react"
import { Bug, CheckCircle2, GitPullRequest, Sparkles, Workflow } from "lucide-react"

export type EvalOutcomeId =
	| "prototype_to_pr"
	| "paper_cuts"
	| "sentry_triage"
	| "repro_to_fix"
	| "review_guardrails"
	| "issue_to_pr"

export type EvalOutcomeCapability = {
	id: string
	name: string
	description: string
	/**
	 * Optional roleId for capabilities that map directly to a role page.
	 * Non-role capabilities represent Roo Code Cloud behaviors (validation, PR packaging, etc.).
	 */
	roleId?: string
}

export type EvalOutcomeProfile = {
	title: string
	description: string
	capabilities: EvalOutcomeCapability[]
	howItWorks: string[]
}

export type EvalOutcome = {
	id: EvalOutcomeId
	name: string
	description: string
	icon: LucideIcon
	/**
	 * Ordered list of roleIds to suggest as a "setup".
	 * Keep roleIds stable even if display names evolve.
	 */
	recommendedRoleIds: string[]
	whyItWorks: string[]
	/**
	 * Optional profile details used to render a more comprehensive “exoskeleton”
	 * for an outcome. Start with the most important outcomes and expand over time.
	 */
	builderProfile?: EvalOutcomeProfile
}

export const EVAL_OUTCOMES: EvalOutcome[] = [
	{
		id: "prototype_to_pr",
		name: "Prototype → PR",
		description: "Build a working prototype on the production codebase, then turn it into a reviewable diff.",
		icon: Sparkles,
		recommendedRoleIds: ["senior", "reviewer"],
		whyItWorks: [
			"Multi-file changes with a reviewer pass for coherence and edge cases.",
			"Optimizes for shipping, not slides.",
		],
		builderProfile: {
			title: "Your Builder Profile",
			description:
				"A default set of capabilities for turning a working prototype into a reviewable PR—on the production codebase.",
			capabilities: [
				{
					id: "multi_file_builder",
					name: "Multi-file Builder",
					description: "Builds the prototype directly in your repo across the files it touches.",
					roleId: "senior",
				},
				{
					id: "reviewer_guardrails",
					name: "Reviewer & Guardrails",
					description: "Reviews the diff for correctness, edge cases, and coherence before you merge.",
					roleId: "reviewer",
				},
				{
					id: "environment_setup",
					name: "Environment setup",
					description:
						"Bootstraps a working dev environment and runs the workflow without you fighting Git, installs, or tests.",
				},
				{
					id: "validation_loop",
					name: "Validation loop",
					description: "Runs tests/lint/typechecks and iterates until it’s clean (or flags what’s blocked).",
				},
				{
					id: "pr_ready_output",
					name: "PR-ready output",
					description: "Produces a focused diff plus a plain-English summary and review notes.",
				},
				{
					id: "straight_line_merge",
					name: "Straight-line to merge",
					description:
						"No export/import step: the work is already on the production codebase, so merge is a straight line.",
				},
				{
					id: "scope_control",
					name: "Scope control",
					description: "Keeps diffs tight: smaller review surface, fewer surprises, and easier merges.",
				},
			],
			howItWorks: [
				"Build a working prototype directly in the production codebase.",
				"Convert the prototype into a tight diff (tests, cleanup, and safeguards).",
				"Run a reviewer pass to catch edge cases and improve merge confidence.",
				"Deliver a PR-ready result with context and next steps.",
			],
		},
	},
	{
		id: "paper_cuts",
		name: "Paper cuts & small fixes",
		description: "Fix the small stuff without dragging engineers off big projects.",
		icon: CheckCircle2,
		recommendedRoleIds: ["junior", "reviewer"],
		whyItWorks: [
			"Small diffs are high-leverage when the work is well-scoped.",
			"Reviewer keeps the quality bar and reduces surprise.",
		],
	},
	{
		id: "sentry_triage",
		name: "Sentry triage",
		description: "Turn recurring errors into concrete fixes with proof before review.",
		icon: Bug,
		recommendedRoleIds: ["autonomous", "reviewer"],
		whyItWorks: [
			"Autonomous runs handle multi-step investigation and iteration.",
			"Reviewer focuses on safety, correctness, and “does this hold up?”.",
		],
	},
	{
		id: "repro_to_fix",
		name: "Bug repro → fix",
		description: "Make the handoff less lossy: reproduce, patch, and validate in one loop.",
		icon: Workflow,
		recommendedRoleIds: ["senior", "reviewer"],
		whyItWorks: [
			"Good default for ambiguous bugs that touch a few files.",
			"Reviewer helps catch cross-team assumptions early.",
		],
	},
	{
		id: "review_guardrails",
		name: "Guardrails & review",
		description: "Raise the quality bar without becoming the blocker.",
		icon: GitPullRequest,
		recommendedRoleIds: ["reviewer"],
		whyItWorks: [
			"Works alongside CI, linters, and team review.",
			"Scales judgement through fast, consistent feedback.",
		],
	},
	{
		id: "issue_to_pr",
		name: "Issue → PR",
		description: "Run end-to-end work in the background and come back to a reviewable result.",
		icon: GitPullRequest,
		recommendedRoleIds: ["autonomous", "reviewer"],
		whyItWorks: [
			"Handles out-of-band work while humans stay on the roadmap.",
			"Pairs autonomy with guardrails for merge safety.",
		],
	},
]

export function isEvalOutcomeId(value: string): value is EvalOutcomeId {
	return EVAL_OUTCOMES.some((o) => o.id === value)
}
