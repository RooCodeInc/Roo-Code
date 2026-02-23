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
	/**
	 * Starter prompt shown in the UI to help users understand what to ask for.
	 * This is product copy, not an eval artifact.
	 */
	examplePrompt?: string
	capabilities: EvalOutcomeCapability[]
	howItWorks: string[]
}

export type EvalOutcome = {
	id: EvalOutcomeId
	/** URL slug used for objective deep dives: /evals/recommendations/<slug> */
	slug: string
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
		id: "review_guardrails",
		slug: "idea-prototype",
		name: "Idea → Prototype",
		description: "Turn a vague idea into a working demo in your real codebase.",
		icon: Sparkles,
		recommendedRoleIds: ["autonomous", "senior"],
		whyItWorks: [
			"Optimizes for momentum: map the codebase fast, then build a working slice.",
			"Senior builder keeps the prototype grounded in production constraints.",
		],
		builderProfile: {
			title: "Your Builder Profile",
			description: "For turning an idea into a working demo in your repo.",
			examplePrompt: `Objective: Idea → Prototype

In this repo, turn this idea into a working demo: <describe the idea>.

Constraints:
- Keep scope small and demo-first.
- Use the existing stack and patterns in this codebase.

Deliver:
- A reviewable PR
- A short walkthrough (how to run it, what works, what’s next)`,
			capabilities: [
				{
					id: "autonomous_researcher",
					name: "Autonomous Researcher",
					description: "Maps the codebase, constraints, and best path forward before implementation starts.",
					roleId: "autonomous",
				},
				{
					id: "multi_file_builder",
					name: "Senior Builder",
					description: "Builds a working prototype directly in your repo across the files it touches.",
					roleId: "senior",
				},
				{
					id: "discovery_loop",
					name: "Discovery loop",
					description:
						"Maps the codebase and constraints before making changes (so the prototype fits reality).",
				},
				{
					id: "prototype_scaffold",
					name: "Prototype scaffold",
					description: "Creates the smallest working slice you can demo and build on.",
				},
				{
					id: "demo_ready_output",
					name: "Demo-ready output",
					description:
						"Delivers a reviewable diff plus a clear walkthrough of what’s working and what’s next.",
				},
			],
			howItWorks: [
				"Clarify the objective and success criteria.",
				"Explore the codebase and pick the smallest viable implementation path.",
				"Build the prototype directly in the repo (no throwaway export/import step).",
				"Deliver a demo-ready diff with notes for the next iteration.",
			],
		},
	},
	{
		id: "prototype_to_pr",
		slug: "prototype-pr",
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
			description: "For turning a prototype into a reviewable PR on the production codebase.",
			examplePrompt: `Objective: Prototype → PR

Take the current prototype implementation and turn it into a reviewable PR.

Do:
- Tighten scope to the smallest shippable diff
- Add/adjust tests, lint, and typechecks as needed

Deliver:
- A PR-ready diff with a plain-English summary and review notes`,
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
		id: "issue_to_pr",
		slug: "issue-pr",
		name: "Issue → PR",
		description: "Run end-to-end work in the background and come back to a reviewable result.",
		icon: GitPullRequest,
		recommendedRoleIds: ["autonomous", "reviewer"],
		whyItWorks: [
			"Handles out-of-band work while humans stay on the roadmap.",
			"Pairs autonomy with guardrails for merge safety.",
		],
		builderProfile: {
			title: "Your Builder Profile",
			description: "For turning an issue into a reviewable PR.",
			examplePrompt: `Objective: Issue → PR

Fix this issue in the repo: <describe the problem and expected behavior>.

Requirements:
- Define “done” in 2-3 acceptance criteria
- Implement the fix and validate it (tests/lint/typechecks)

Deliver:
- A reviewable PR with context and any follow-ups`,
			capabilities: [
				{
					id: "autonomous_executor",
					name: "Autonomous Executor",
					description: "Runs the full loop (investigate → implement → validate) while you stay unblocked.",
					roleId: "autonomous",
				},
				{
					id: "reviewer_guardrails",
					name: "Reviewer & Guardrails",
					description: "Reviews the diff for correctness, edge cases, and merge safety.",
					roleId: "reviewer",
				},
				{
					id: "issue_intake",
					name: "Issue intake",
					description:
						"Translates a request into scoped tasks, acceptance criteria, and a safe plan of attack.",
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
			],
			howItWorks: [
				"Clarify the issue and define what “done” means.",
				"Implement in the background with frequent validation checkpoints.",
				"Run a reviewer pass to reduce merge risk.",
				"Deliver a PR-ready result with context and next steps.",
			],
		},
	},
	{
		id: "sentry_triage",
		slug: "customer-escalation-resolved",
		name: "Customer Escalation → Resolved",
		description: "Triage a customer-blocking issue and ship the smallest safe fix.",
		icon: Bug,
		recommendedRoleIds: ["autonomous", "senior", "reviewer"],
		whyItWorks: [
			"Autonomous runs handle multi-step investigation and iteration.",
			"Senior builder makes the final fix precise and production-safe.",
			"Reviewer focuses on safety, correctness, and “does this hold up?”.",
		],
		builderProfile: {
			title: "Your Builder Profile",
			description: "For resolving a customer escalation quickly and safely.",
			examplePrompt: `Objective: Customer Escalation → Resolved

We have a customer-blocking escalation:
- Symptoms: <what the customer sees>
- Context: <logs/errors/links if available>

Do:
- Find the smallest safe fix with a clear blast-radius assessment
- Add guardrails/tests where it makes sense

Deliver:
- A PR with the fix and a short “risk + rollout” note`,
			capabilities: [
				{
					id: "autonomous_triage",
					name: "Autonomous Triage",
					description: "Investigates logs, context, and repro steps to converge on a fix quickly.",
					roleId: "autonomous",
				},
				{
					id: "senior_fixer",
					name: "Senior Builder",
					description: "Implements the smallest production-safe fix when the blast radius is unclear.",
					roleId: "senior",
				},
				{
					id: "reviewer_guardrails",
					name: "Reviewer & Guardrails",
					description: "Double-checks safety and correctness so speed doesn’t create regressions.",
					roleId: "reviewer",
				},
				{
					id: "repro_first",
					name: "Repro-first",
					description: "Prioritizes a minimal reproduction so we know the fix actually fixes the issue.",
				},
				{
					id: "minimal_fix",
					name: "Minimal safe fix",
					description: "Ships the smallest change that unblocks customers, with a clear rollback story.",
				},
				{
					id: "verification_artifacts",
					name: "Verification artifacts",
					description: "Provides proof (tests/logs/steps) that the fix works and what it covers.",
				},
			],
			howItWorks: [
				"Gather context and reproduce the customer issue.",
				"Implement the smallest safe fix with verification.",
				"Run a reviewer pass to catch edge cases.",
				"Deliver a PR-ready result plus rollout notes.",
			],
		},
	},
	{
		id: "repro_to_fix",
		slug: "bug-report-fix",
		name: "Bug Report → Fix",
		description: "Reproduce, isolate, patch, and validate in one loop.",
		icon: Workflow,
		recommendedRoleIds: ["senior", "reviewer"],
		whyItWorks: [
			"Good default for ambiguous bugs that touch a few files.",
			"Reviewer helps catch cross-team assumptions early.",
		],
		builderProfile: {
			title: "Your Builder Profile",
			description: "For turning a bug report into a verified fix.",
			examplePrompt: `Objective: Bug Report → Fix

Fix this bug:
- Report: <paste or summarize>
- Expected vs actual: <what should happen vs what happens>

Do:
- Reproduce if possible, then implement the fix
- Validate with tests/lint/typechecks (or explain what’s blocked)

Deliver:
- A PR with the fix and verification notes`,
			capabilities: [
				{
					id: "bug_fixer",
					name: "Bug Fixer",
					description: "Reproduces and fixes bugs efficiently across the files involved.",
					roleId: "senior",
				},
				{
					id: "reviewer_guardrails",
					name: "Reviewer & Guardrails",
					description: "Reviews the diff for correctness and regression risk before it ships.",
					roleId: "reviewer",
				},
				{
					id: "repro_harness",
					name: "Repro harness",
					description:
						"Creates a minimal reproduction path (tests or steps) to prevent “can’t repro” stalls.",
				},
				{
					id: "fix_with_tests",
					name: "Fix with tests",
					description: "Pairs the fix with verification so it doesn’t regress on the next change.",
				},
				{
					id: "validation_loop",
					name: "Validation loop",
					description: "Runs tests/lint/typechecks and iterates until it’s clean (or flags what’s blocked).",
				},
			],
			howItWorks: [
				"Reproduce the issue and isolate the root cause.",
				"Implement a targeted fix with verification.",
				"Run a reviewer pass to reduce regression risk.",
				"Deliver a PR-ready result with steps to validate.",
			],
		},
	},
	{
		id: "paper_cuts",
		slug: "paper-cuts-shipped",
		name: "Paper Cuts → Shipped",
		description: "Fix the small stuff without dragging engineers off big projects.",
		icon: CheckCircle2,
		recommendedRoleIds: ["junior", "reviewer"],
		whyItWorks: [
			"Small diffs are high-leverage when the work is well-scoped.",
			"Reviewer keeps the quality bar and reduces surprise.",
		],
		builderProfile: {
			title: "Your Builder Profile",
			description: "For shipping small fixes quickly, cleanly, and safely.",
			examplePrompt: `Objective: Paper Cuts → Shipped

Ship these small fixes in this repo:
- <paper cut 1>
- <paper cut 2>
- <paper cut 3>

Constraints:
- Keep diffs small and easy to review
- Don’t change behavior unless it’s clearly a bug

Deliver:
- A PR with grouped, well-scoped commits and a short summary`,
			capabilities: [
				{
					id: "small_diff_builder",
					name: "Small-diff Builder",
					description: "Ships focused fixes with low review surface area and minimal risk.",
					roleId: "junior",
				},
				{
					id: "reviewer_guardrails",
					name: "Reviewer & Guardrails",
					description: "Catches edge cases and keeps changes aligned with team conventions.",
					roleId: "reviewer",
				},
				{
					id: "scope_control",
					name: "Scope control",
					description: "Keeps changes tight: fewer surprises, faster reviews, easier merges.",
				},
				{
					id: "quick_validation",
					name: "Quick validation",
					description: "Runs the relevant checks and flags what’s safe to skip (and what’s not).",
				},
				{
					id: "pr_ready_output",
					name: "PR-ready output",
					description: "Produces a focused diff plus a plain-English summary and review notes.",
				},
			],
			howItWorks: [
				"Pick the smallest fix that moves the needle.",
				"Implement with tight scope control.",
				"Validate quickly and review for conventions.",
				"Deliver a PR-ready result you can merge confidently.",
			],
		},
	},
]

export function isEvalOutcomeId(value: string): value is EvalOutcomeId {
	return EVAL_OUTCOMES.some((o) => o.id === value)
}

export function getEvalOutcomeBySlug(slug: string): EvalOutcome | undefined {
	return EVAL_OUTCOMES.find((o) => o.slug === slug)
}
