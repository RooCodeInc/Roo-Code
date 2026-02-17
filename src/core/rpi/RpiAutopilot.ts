import fs from "fs/promises"
import * as path from "path"
import { getModelId, type ProviderSettings } from "@roo-code/types"

import {
	type RpiCouncilResult,
	type RpiCodeReviewResult,
	RpiCouncilEngine,
	type RpiCouncilInput,
} from "./engine/RpiCouncilEngine"
import { RpiCorrectionEngine, type RpiCorrectionSuggestion } from "./engine/RpiCorrectionEngine"
import { RpiVerificationEngine } from "./engine/RpiVerificationEngine"
import { RpiMemory } from "./RpiMemory"
import { classifyRpiToolRisk, loadRpiPolicyBundle, type RpiPolicyBundle, type RpiRiskClass } from "./RpiPolicy"

type RpiStrategy = "quick" | "standard" | "full"
type RpiPhase = "discovery" | "planning" | "implementation" | "verification" | "done"
type RpiCouncilPhase = Exclude<RpiPhase, "implementation" | "done">
type RpiThrottleMode = "normal" | "throttled" | "fallback"

type RpiEventLevel = "info" | "warn" | "error"

export interface RpiToolObservation {
	toolName: string
	timestamp: string
	success: boolean
	error?: string
	summary: string
	outputSnippet?: string
	filesAffected?: string[]
	exitCode?: number
	diffSummary?: string
	matchCount?: number
	durationMs?: number
	/** MCP metadata when toolName is `use_mcp_tool` */
	mcpServerName?: string
	mcpToolName?: string
}

interface RpiTaskStep {
	id: string
	description: string
	status: "pending" | "in_progress" | "completed" | "blocked" | "skipped"
	phase: RpiPhase
	toolsExpected?: string[]
	toolsUsed: string[]
	observationIds: number[]
	outcome?: string
	blockedReason?: string
}

interface RpiTaskPlan {
	version: 2
	taskSummary: string
	decompositionSource: "council" | "heuristic"
	steps: RpiTaskStep[]
	currentStepIndex: number
	lastUpdatedAt: string
}

interface RpiTraceEvent {
	type:
		| "policy_loaded"
		| "tool_start"
		| "tool_finish"
		| "verification_failed"
		| "code_review_blocked"
		| "evidence_gate_failed"
		| "adaptive_throttle_changed"
		| "cost_guardrail_warned"
		| "cost_guardrail_blocked"
		| "canary_state_changed"
		| "canary_gate_failed"
		| "completion_accepted"
	taskId: string
	timestamp: string
	phase: RpiPhase
	detail?: string
	toolName?: string
	mcpToolName?: string
	success?: boolean
	riskClass?: RpiRiskClass
	throttleMode?: RpiThrottleMode
	costUsd?: number
	costRatio?: number
	fingerprint?: string
	canaryStatus?: "active" | "stable" | "blocked"
}

const MAX_OBSERVATIONS = 20
const MAX_PROGRESS_EVENTS = 30

interface RpiState {
	version: 1
	taskId: string
	taskSummary: string
	modeAtStart: string
	strategy: RpiStrategy
	phase: RpiPhase
	requiredPhases: RpiPhase[]
	completedPhases: RpiPhase[]
	toolRuns: number
	writeOps: number
	commandOps: number
	notesCount: number
	councilTotalRuns: number
	councilRunsByPhase: Partial<Record<RpiCouncilPhase, number>>
	lastTool?: string
	lastToolAt?: string
	lastUpdatedAt: string
	createdAt: string
	observations: RpiToolObservation[]
	lastObservation?: RpiToolObservation
	observationCount: number
	stepAttempts: Record<string, number>
	codeReviewRuns: number
	codeReviewScore?: number
	throttleMode: RpiThrottleMode
	lastRuntimeSnapshot?: {
		failureRate: number
		p95LatencyMs: number
		recentCount: number
		costUsd?: number
		costRatio?: number
	}
}

interface RpiCanaryState {
	version: 1
	fingerprint: string
	status: "active" | "stable" | "blocked"
	sampleSize: number
	samples: number
	failedSamples: number
	lastUpdatedAt: string
}

interface RpiAutopilotContext {
	taskId: string
	cwd: string
	getMode: () => Promise<string>
	getTaskText: () => string | undefined
	getApiConfiguration: () => Promise<ProviderSettings | undefined>
	getTokenUsage?: () => { totalCost?: number; totalTokensIn?: number; totalTokensOut?: number } | undefined
	isCouncilEngineEnabled: () => boolean
	getVerificationStrictness?: () => "lenient" | "standard" | "strict"
	/**
	 * When a parent task is resumed after a delegated child completes, the parent history
	 * includes the child's taskId. Expose it so RPI can consider the child's tool evidence.
	 */
	getCompletedChildTaskId?: () => string | undefined
	onCouncilEvent?: (event: {
		phase: RpiCouncilPhase
		trigger: "phase_change" | "completion_attempt" | "complexity_threshold"
		status: "started" | "heartbeat" | "completed" | "skipped"
		summary?: string
		error?: string
		elapsedSeconds?: number
	}) => void
	onAutopilotEvent?: (event: {
		status: "initialized" | "phase_changed"
		phase: RpiPhase
		previousPhase?: RpiPhase
		trigger?: string
	}) => void
	getCodeReviewScoreThreshold?: () => number
	isCodeReviewEnabled?: () => boolean
	onCodeReviewEvent?: (event: {
		status: "started" | "completed" | "skipped"
		filesCount?: number
		score?: number
		issuesCount?: number
		reviewMarkdown?: string
		error?: string
		elapsedSeconds?: number
	}) => void
}

const WRITE_TOOLS = new Set<string>([
	"write_to_file",
	"apply_diff",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"generate_image",
])

const COMMAND_TOOLS = new Set<string>(["execute_command", "read_command_output"])

const IMPLEMENTATION_TOOLS = new Set<string>([...WRITE_TOOLS, ...COMMAND_TOOLS, "use_mcp_tool"])

const MCP_WRITE_TOOL_NAMES = new Set<string>([
	"edit_file",
	"write_file",
	"write_to_file",
	"apply_diff",
	"search_and_replace",
	"search_replace",
	"apply_patch",
	"delete_file",
	"move_file",
	"rename_file",
	"create_file",
])

const MCP_COMMAND_TOOL_NAMES = new Set<string>(["execute_command", "read_command_output", "run_command"])

const isRpiStateMutationPath = (filePath: string): boolean => {
	const normalized = filePath.replace(/\\/g, "/").toLowerCase()
	return (
		(normalized.includes("/.roo/rpi/") || normalized.startsWith(".roo/rpi/")) && normalized.endsWith("/state.json")
	)
}

const PLANNING_TOOLS = new Set<string>(["update_todo_list", "ask_followup_question", "switch_mode", "new_task"])

const DISCOVERY_TOOLS = new Set<string>([
	"read_file",
	"list_files",
	"search_files",
	"codebase_search",
	"access_mcp_resource",
	"browser_action",
	"run_slash_command",
	"skill",
])

const MODES_REQUIRING_IMPLEMENTATION_EVIDENCE = new Set<string>(["code", "debug", "orchestrator"])
const MODES_WITH_HIGH_COUNCIL_SENSITIVITY = new Set<string>(["architect", "orchestrator"])
const COUNCIL_PHASES: readonly RpiCouncilPhase[] = ["discovery", "planning", "verification"]
const MAX_COUNCIL_RUNS_PER_PHASE = 1
const MAX_COUNCIL_RUNS_PER_TASK = 3
const DEFAULT_COUNCIL_PROMPT_MAX_CHARS = 5000
const MAX_COUNCIL_FINDINGS = 6
const MAX_COUNCIL_RISKS = 4
const MAX_CODE_REVIEW_RUNS_PER_TASK = 1
const DEFAULT_CODE_REVIEW_TIMEOUT_MS = 120_000
const DEFAULT_CODE_REVIEW_MAX_FILE_CHARS = 15_000
const DEFAULT_ADAPTIVE_WINDOW = 8
const DEFAULT_REPLAN_INTERVAL = 5
const CODE_REVIEW_BINARY_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".ico",
	".svg",
	".woff",
	".woff2",
	".ttf",
	".eot",
	".mp3",
	".mp4",
	".zip",
	".tar",
	".gz",
	".pdf",
	".exe",
	".dll",
	".so",
	".dylib",
	".bin",
	".dat",
])

export class RpiAutopilot {
	private state?: RpiState
	private initialized = false
	private ioQueue: Promise<void> = Promise.resolve()
	private readonly councilEngine: RpiCouncilEngine
	private readonly correctionEngine: RpiCorrectionEngine
	private readonly verificationEngine: RpiVerificationEngine
	private readonly memory: RpiMemory
	private policyBundle?: RpiPolicyBundle
	private progressEvents: string[] = []
	private taskPlan?: RpiTaskPlan
	private pendingCorrectionHint?: RpiCorrectionSuggestion
	private readonly toolStartAt = new Map<string, number>()
	private canaryState?: RpiCanaryState
	private canaryOutcomeRecorded = false

	/** Expose observations and plan for ContextDistiller integration */
	get currentObservations(): RpiToolObservation[] {
		return this.state?.observations ?? []
	}

	get currentPlan(): RpiTaskPlan | undefined {
		return this.taskPlan
	}

	constructor(
		private readonly context: RpiAutopilotContext,
		councilEngine?: RpiCouncilEngine,
	) {
		this.councilEngine = councilEngine ?? new RpiCouncilEngine()
		this.correctionEngine = new RpiCorrectionEngine()
		this.verificationEngine = new RpiVerificationEngine()
		this.memory = new RpiMemory(context.cwd)
	}

	async ensureInitialized(): Promise<void> {
		if (this.initialized) {
			return
		}

		await this.queueWrite(async () => {
			if (this.initialized) {
				return
			}

			await fs.mkdir(this.baseDir, { recursive: true })
			await this.loadPolicyBundle()
			const mode = await this.context.getMode()
			const taskText = this.context.getTaskText() ?? ""
			const fromDisk = await this.readStateFile()

			if (fromDisk && fromDisk.taskId === this.context.taskId) {
				this.state = this.normalizeState(fromDisk)
			} else {
				const legacyState = await this.readLegacyStateFile()
				if (legacyState && legacyState.taskId === this.context.taskId) {
					this.state = this.normalizeState(legacyState)
					await this.maybeMigrateLegacyArtifacts()
				} else {
					this.state = this.createInitialState(mode, taskText)
				}
			}
			await this.loadCanaryState()
			await this.enforceCanaryFingerprint()

			// Initialize dynamic task plan if not yet created
			// Prefer AI-driven decomposition when council engine is enabled
			if (!this.taskPlan && this.state) {
				if (this.context.isCouncilEngineEnabled() && taskText.length > 50) {
					try {
						this.taskPlan = await this.aiDecompose(taskText, mode)
					} catch {
						// Fallback to heuristic if AI decomposition fails
						this.taskPlan = this.heuristicDecompose(taskText, mode)
					}
				} else {
					this.taskPlan = this.heuristicDecompose(taskText, mode)
				}
			}

			// Recall relevant memories from cross-task memory
			if (taskText) {
				try {
					const freshnessPolicy = this.policyBundle?.qualityGates.memory
					const memories = await this.memory.recall(taskText, 5, {
						freshnessTtlHours: freshnessPolicy?.freshnessTtlHours,
						maxStaleResults: freshnessPolicy?.maxStaleResults,
					})
					if (memories.length > 0) {
						for (const mem of memories) {
							this.appendProgress(`Memory recalled [${mem.type}]: ${mem.content}`)
						}
					}
					if (freshnessPolicy) {
						const freshnessStats = await this.memory.getFreshnessStats(freshnessPolicy.freshnessTtlHours)
						if (freshnessStats.stale > 0) {
							this.appendProgress(
								`Memory freshness: ${freshnessStats.fresh}/${freshnessStats.total} fresh entries (${freshnessStats.stale} stale).`,
							)
						}
					}
				} catch {
					// Memory recall is best-effort, don't block initialization
				}
			}

			await this.syncArtifacts()
			this.initialized = true
			if (this.state) {
				this.notifyAutopilotEvent({
					status: "initialized",
					phase: this.state.phase,
				})
			}
		})
	}

	/**
	 * Fast initialization path: only performs disk I/O and heuristic decomposition.
	 * Skips AI decomposition and memory recall to avoid blocking the task loop.
	 * Use `deferAiEnhancement()` afterwards for AI-driven plan improvement.
	 */
	async ensureInitializedFast(): Promise<void> {
		if (this.initialized) {
			return
		}

		await this.queueWrite(async () => {
			if (this.initialized) {
				return
			}

			await fs.mkdir(this.baseDir, { recursive: true })
			await this.loadPolicyBundle()
			const mode = await this.context.getMode()
			const taskText = this.context.getTaskText() ?? ""
			const fromDisk = await this.readStateFile()

			if (fromDisk && fromDisk.taskId === this.context.taskId) {
				this.state = this.normalizeState(fromDisk)
			} else {
				const legacyState = await this.readLegacyStateFile()
				if (legacyState && legacyState.taskId === this.context.taskId) {
					this.state = this.normalizeState(legacyState)
					await this.maybeMigrateLegacyArtifacts()
				} else {
					this.state = this.createInitialState(mode, taskText)
				}
			}
			await this.loadCanaryState()
			await this.enforceCanaryFingerprint()

			// Always use heuristic decomposition for fast init (instant)
			if (!this.taskPlan && this.state) {
				this.taskPlan = this.heuristicDecompose(taskText, mode)
			}

			await this.syncArtifacts()
			this.initialized = true
			if (this.state) {
				this.notifyAutopilotEvent({
					status: "initialized",
					phase: this.state.phase,
				})
			}
		})
	}

	private async loadPolicyBundle(): Promise<void> {
		if (this.policyBundle) {
			return
		}

		try {
			this.policyBundle = await loadRpiPolicyBundle(this.context.cwd)
			for (const warning of this.policyBundle.loadWarnings) {
				this.appendProgress(`Policy warning: ${warning}`)
			}
			await this.appendExecutionTrace({
				type: "policy_loaded",
				taskId: this.context.taskId,
				timestamp: new Date().toISOString(),
				phase: this.state?.phase ?? "discovery",
				detail: `risk=${this.policyBundle.metadata.riskMatrixPath}, quality=${this.policyBundle.metadata.qualityGatesPath}`,
			})
		} catch (error) {
			this.appendProgress(
				`Policy load failed, defaults active: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Deferred AI enhancement: runs AI decomposition and memory recall in background.
	 * Should be called fire-and-forget after `ensureInitializedFast()`.
	 * Updates the task plan in-place if AI decomposition succeeds.
	 */
	async deferAiEnhancement(): Promise<void> {
		if (!this.initialized || !this.state) {
			return
		}

		const taskText = this.context.getTaskText() ?? ""
		const mode = await this.context.getMode()

		// AI-driven decomposition (only if council engine enabled + task text substantial)
		if (this.context.isCouncilEngineEnabled() && taskText.length > 50) {
			try {
				const aiPlan = await this.aiDecompose(taskText, mode)
				this.taskPlan = aiPlan
				await this.queueWrite(async () => {
					await this.writeTaskPlanFile()
				})
			} catch {
				// Keep heuristic plan — AI enhancement is best-effort
			}
		}

		// Memory recall (best-effort)
		if (taskText) {
			try {
				const freshnessPolicy = this.policyBundle?.qualityGates.memory
				const memories = await this.memory.recall(taskText, 5, {
					freshnessTtlHours: freshnessPolicy?.freshnessTtlHours,
					maxStaleResults: freshnessPolicy?.maxStaleResults,
				})
				if (memories.length > 0) {
					for (const mem of memories) {
						this.appendProgress(`Memory recalled [${mem.type}]: ${mem.content}`)
					}
					await this.queueWrite(async () => {
						await this.writeProgressFile()
					})
				}
			} catch {
				// Memory recall is best-effort
			}
		}
	}

	async getPromptGuidance(): Promise<string | undefined> {
		await this.ensureInitialized()
		if (!this.state) {
			return undefined
		}

		const plan = this.taskPlan
		const currentStep = plan?.steps[plan.currentStepIndex]
		const pendingSteps = plan?.steps.filter((s) => s.status === "pending" || s.status === "in_progress")
		const completedCount = plan?.steps.filter((s) => s.status === "completed").length ?? 0
		const totalSteps = plan?.steps.length ?? 0

		const lines: string[] = [
			`RPI autopilot active. Strategy: ${this.state.strategy}. Phase: ${this.state.phase}.`,
			`Council engine: ${this.context.isCouncilEngineEnabled() ? "enabled" : "disabled"}.`,
		]
		if (this.state.throttleMode !== "normal") {
			lines.push(`Runtime mode: ${this.state.throttleMode}.`)
		}
		if (this.canaryState) {
			lines.push(
				`Canary status: ${this.canaryState.status} (${this.canaryState.samples}/${this.canaryState.sampleSize}).`,
			)
		}

		// Attention mechanism: current step and next steps
		if (currentStep) {
			lines.push(`CURRENT STEP [${completedCount + 1}/${totalSteps}]: ${currentStep.description}`)
		}
		if (pendingSteps && pendingSteps.length > 1) {
			const next = pendingSteps
				.slice(1, 3)
				.map((s) => s.description)
				.join("; ")
			lines.push(`NEXT: ${next}`)
		}

		// Last observation for continuity
		if (this.state.lastObservation) {
			lines.push(`Last result: ${this.state.lastObservation.summary}`)
		}

		// Correction hint if pending
		if (this.pendingCorrectionHint) {
			lines.push(`CORRECTION: ${this.pendingCorrectionHint.reasoning}`)
		}

		// References to artifacts
		lines.push(
			`Plan: ${this.relativeTaskPlanPath}. Notes: ${this.relativeFindingsPath}. Trace: .roo/rpi/${this.taskDirName}/execution_trace.jsonl.`,
		)

		return lines.join(" ")
	}

	async onToolStart(toolName: string, params?: Record<string, unknown>): Promise<void> {
		await this.ensureInitialized()
		if (!this.state) {
			return
		}

		await this.queueWrite(async () => {
			if (!this.state) {
				return
			}

			const previousPhase = this.state.phase
			this.state.toolRuns += 1
			this.toolStartAt.set(toolName, Date.now())
			this.state.lastTool = toolName
			this.state.lastToolAt = new Date().toISOString()
			this.state.lastUpdatedAt = new Date().toISOString()

			const mcpToolName =
				toolName === "use_mcp_tool" && typeof params?.tool_name === "string" ? params.tool_name : undefined
			const riskClass = this.classifyToolRisk(toolName, mcpToolName)
			const mcpArgs =
				toolName === "use_mcp_tool" && params && typeof (params as any).arguments === "object"
					? ((params as any).arguments as Record<string, unknown> | undefined)
					: undefined
			const mcpPath = typeof mcpArgs?.path === "string" ? (mcpArgs.path as string) : undefined

			const shouldCountMcpWrite =
				!!mcpToolName && MCP_WRITE_TOOL_NAMES.has(mcpToolName) && (!mcpPath || !isRpiStateMutationPath(mcpPath))

			if (WRITE_TOOLS.has(toolName) || shouldCountMcpWrite) {
				this.state.writeOps += 1
			}

			if (COMMAND_TOOLS.has(toolName) || (!!mcpToolName && MCP_COMMAND_TOOL_NAMES.has(mcpToolName))) {
				this.state.commandOps += 1
			}

			this.applyAutomaticPhaseTransition(toolName)
			const currentPhase = this.state.phase

			if (DISCOVERY_TOOLS.has(toolName) && this.state.phase === "discovery") {
				this.state.notesCount += 1
				await this.appendFinding("info", `Discovery activity via \`${toolName}\`.`)
			}

			if (PLANNING_TOOLS.has(toolName) && this.state.strategy !== "quick") {
				await this.appendFinding("info", `Planning activity via \`${toolName}\`.`)
			}

			const effectivePath =
				typeof params?.path === "string"
					? params.path
					: toolName === "use_mcp_tool" && typeof mcpPath === "string"
						? mcpPath
						: undefined

			if (effectivePath && (WRITE_TOOLS.has(toolName) || shouldCountMcpWrite)) {
				this.appendProgress(`Tool \`${toolName}\` started on \`${effectivePath}\`.`)
			} else if (IMPLEMENTATION_TOOLS.has(toolName)) {
				this.appendProgress(`Tool \`${toolName}\` started.`)
			}

			await this.appendExecutionTrace({
				type: "tool_start",
				taskId: this.context.taskId,
				timestamp: new Date().toISOString(),
				phase: this.state.phase,
				toolName,
				mcpToolName,
				riskClass,
			})

			if (currentPhase !== previousPhase) {
				this.notifyAutopilotEvent({
					status: "phase_changed",
					phase: currentPhase,
					previousPhase,
					trigger: toolName,
				})
				await this.maybeRunCouncilForPhase(currentPhase, "phase_change")
			}

			if (currentPhase === "discovery" && this.hasComplexitySignal()) {
				await this.maybeRunCouncilForPhase("discovery", "complexity_threshold")
			}

			await this.syncArtifacts()
		})
	}

	async onToolFinish(toolName: string, observation: RpiToolObservation): Promise<void> {
		await this.ensureInitialized()
		if (!this.state) {
			return
		}

		await this.queueWrite(async () => {
			if (!this.state) {
				return
			}

			this.state.lastUpdatedAt = new Date().toISOString()
			const startedAt = this.toolStartAt.get(toolName)
			this.toolStartAt.delete(toolName)
			const normalizedObservation: RpiToolObservation =
				observation.durationMs === undefined && startedAt
					? {
							...observation,
							durationMs: Math.max(0, Date.now() - startedAt),
						}
					: observation

			// Store observation in rolling window
			this.state.observations.push(normalizedObservation)
			if (this.state.observations.length > MAX_OBSERVATIONS) {
				this.state.observations.shift()
			}
			this.state.lastObservation = normalizedObservation
			this.state.observationCount += 1

			// Rich progress logging based on observation
			if (!normalizedObservation.success) {
				this.appendProgress(`Tool \`${toolName}\` FAILED -> ${normalizedObservation.summary}`)
				await this.appendFinding(
					"error",
					`Tool \`${toolName}\` failed: ${normalizedObservation.error ?? normalizedObservation.summary}`,
				)
			} else if (IMPLEMENTATION_TOOLS.has(toolName) || PLANNING_TOOLS.has(toolName)) {
				this.appendProgress(`Tool \`${toolName}\` -> ${normalizedObservation.summary}`)
			}

			const riskClass = this.classifyToolRisk(toolName, normalizedObservation.mcpToolName)
			await this.appendExecutionTrace({
				type: "tool_finish",
				taskId: this.context.taskId,
				timestamp: new Date().toISOString(),
				phase: this.state.phase,
				toolName,
				mcpToolName: normalizedObservation.mcpToolName,
				riskClass,
				success: normalizedObservation.success,
				detail: normalizedObservation.error ?? normalizedObservation.summary,
			})
			if (normalizedObservation.success && (riskClass === "R2" || riskClass === "R3")) {
				await this.appendFinding(
					riskClass === "R3" ? "warn" : "info",
					`Risk-class ${riskClass} tool completed: \`${toolName}\`${normalizedObservation.mcpToolName ? ` (${normalizedObservation.mcpToolName})` : ""}.`,
				)
			}

			// Correction engine: analyze failures and suggest next action
			if (!normalizedObservation.success) {
				const stepKey = this.taskPlan?.steps[this.taskPlan.currentStepIndex]?.id ?? toolName
				this.state.stepAttempts[stepKey] = (this.state.stepAttempts[stepKey] ?? 0) + 1

				const correction = this.correctionEngine.analyze({
					failedToolName: toolName,
					errorMessage: normalizedObservation.error ?? "Unknown error",
					observation: normalizedObservation,
					recentObservations: this.state.observations.slice(-5),
					attemptCount: this.state.stepAttempts[stepKey],
				})

				this.pendingCorrectionHint = correction
				await this.appendFinding("warn", `Correction (L${correction.escalationLevel}): ${correction.reasoning}`)

				// Phase regression if suggested
				if (correction.action === "phase_regression" && this.state.phase === "implementation") {
					const previousPhase = this.state.phase
					this.state.phase = "discovery"
					this.notifyAutopilotEvent({
						status: "phase_changed",
						phase: "discovery",
						previousPhase,
						trigger: "correction_regression",
					})
				}
			} else {
				this.pendingCorrectionHint = undefined
				// Reset attempt count on success
				const stepKey = this.taskPlan?.steps[this.taskPlan.currentStepIndex]?.id
				if (stepKey) {
					this.state.stepAttempts[stepKey] = 0
				}
			}

			// Auto-advance dynamic plan steps based on observation
			this.autoAdvanceStep(normalizedObservation)

			// Phase 5.1: Adaptive re-planning - check if plan needs revision
			await this.evaluateAdaptiveRuntimeControls()
			await this.maybeRevisePlan()

			await this.syncArtifacts()
		})
	}

	async getCompletionBlocker(): Promise<string | undefined> {
		await this.ensureInitialized()
		if (!this.state) {
			return undefined
		}

		return this.queueRead(async () => {
			if (!this.state) {
				return undefined
			}

			// Move to verification automatically when completion is attempted.
			if (this.state.phase !== "verification" && this.state.phase !== "done") {
				const previousPhase = this.state.phase
				this.completePhase(this.state.phase)
				this.state.phase = "verification"
				this.notifyAutopilotEvent({
					status: "phase_changed",
					phase: "verification",
					previousPhase,
					trigger: "completion_attempt",
				})
			}

			// Discovery/planning are auto-completed when closing to keep flow simple.
			for (const phase of this.state.requiredPhases) {
				if ((phase === "discovery" || phase === "planning") && !this.state.completedPhases.includes(phase)) {
					this.completePhase(phase)
				}
			}

			const currentMode = (await this.context.getMode()) || this.state.modeAtStart
			const hasImplementationEvidence = this.state.writeOps > 0 || this.state.commandOps > 0

			if (this.shouldRunVerificationCouncil(currentMode, hasImplementationEvidence)) {
				await this.maybeRunCouncilForPhase("verification", "completion_attempt")
			}

			const completedChildTaskId = this.context.getCompletedChildTaskId?.()
			const childEvidence = completedChildTaskId
				? await this.tryLoadExternalEvidence(completedChildTaskId)
				: undefined

			const effectiveObservations = childEvidence
				? [...this.state.observations, ...childEvidence.observations]
				: this.state.observations
			const effectiveWriteOps = this.state.writeOps + (childEvidence?.writeOps ?? 0)
			const effectiveCommandOps = this.state.commandOps + (childEvidence?.commandOps ?? 0)
			await this.evaluateAdaptiveRuntimeControls()

			const costGuardrailBlocker = this.getCostGuardrailCompletionBlocker()
			if (costGuardrailBlocker) {
				await this.appendExecutionTrace({
					type: "cost_guardrail_blocked",
					taskId: this.context.taskId,
					timestamp: new Date().toISOString(),
					phase: this.state.phase,
					detail: costGuardrailBlocker,
					costUsd: this.state.lastRuntimeSnapshot?.costUsd,
					costRatio: this.state.lastRuntimeSnapshot?.costRatio,
					throttleMode: this.state.throttleMode,
				})
				await this.writeReplayRecord("cost_guardrail_blocked", {
					blocker: costGuardrailBlocker,
					runtimeSnapshot: this.state.lastRuntimeSnapshot,
					effectiveWriteOps,
					effectiveCommandOps,
				})
				this.state.lastUpdatedAt = new Date().toISOString()
				await this.syncArtifacts()
				return costGuardrailBlocker
			}

			if (this.canaryState?.status === "blocked") {
				const blocker = `RPI canary gate is blocked for fingerprint ${this.canaryState.fingerprint}. Adjust rollout policy or switch provider/model before completing.`
				await this.appendExecutionTrace({
					type: "canary_gate_failed",
					taskId: this.context.taskId,
					timestamp: new Date().toISOString(),
					phase: this.state.phase,
					detail: blocker,
					fingerprint: this.canaryState.fingerprint,
					canaryStatus: this.canaryState.status,
				})
				await this.writeReplayRecord("canary_gate_failed", {
					blocker,
					canaryState: this.canaryState,
				})
				await this.recordCanaryOutcome(false)
				this.state.lastUpdatedAt = new Date().toISOString()
				await this.syncArtifacts()
				return blocker
			}

			// Run verification engine with quality gates
			const strictness = this.context.getVerificationStrictness?.() ?? "lenient"
			const verificationPolicy = this.policyBundle?.qualityGates.verification
			const verification = this.verificationEngine.evaluate({
				observations: effectiveObservations,
				taskText: this.context.getTaskText() ?? "",
				mode: currentMode,
				strictness,
				writeOps: effectiveWriteOps,
				commandOps: effectiveCommandOps,
				policy: verificationPolicy,
			})

			if (!verification.passed) {
				const failed = verification.checks
					.filter((c) => c.status === "failed")
					.map((c) => `- ${c.name}: ${c.detail}`)
					.join("\n")
				await this.appendExecutionTrace({
					type: "verification_failed",
					taskId: this.context.taskId,
					timestamp: new Date().toISOString(),
					phase: this.state.phase,
					detail: failed,
				})
				await this.writeReplayRecord("verification_failed", {
					strictness,
					failedChecks: verification.checks.filter((c) => c.status === "failed"),
					suggestions: verification.suggestions,
					effectiveWriteOps,
					effectiveCommandOps,
				})
				this.state.lastUpdatedAt = new Date().toISOString()
				await this.syncArtifacts()
				return `RPI verification failed:\n${failed}\n\nSuggestions:\n${verification.suggestions.join("\n")}`
			}

			// Senior code review gate
			const codeReviewBlocker = await this.maybeRunCodeReview()
			if (codeReviewBlocker) {
				await this.appendExecutionTrace({
					type: "code_review_blocked",
					taskId: this.context.taskId,
					timestamp: new Date().toISOString(),
					phase: this.state.phase,
					detail: codeReviewBlocker,
				})
				await this.writeReplayRecord("code_review_blocked", {
					blocker: codeReviewBlocker,
					effectiveWriteOps,
					effectiveCommandOps,
				})
				this.appendProgress("Completion blocked by senior code review gate.")
				this.state.lastUpdatedAt = new Date().toISOString()
				await this.syncArtifacts()
				return codeReviewBlocker
			}

			const canaryCompletionBlocker = this.getCanaryCompletionBlocker()
			if (canaryCompletionBlocker) {
				await this.appendExecutionTrace({
					type: "canary_gate_failed",
					taskId: this.context.taskId,
					timestamp: new Date().toISOString(),
					phase: this.state.phase,
					detail: canaryCompletionBlocker,
					fingerprint: this.canaryState?.fingerprint,
					canaryStatus: this.canaryState?.status ?? "active",
				})
				await this.writeReplayRecord("canary_gate_failed", {
					blocker: canaryCompletionBlocker,
					canaryState: this.canaryState,
					runtimeSnapshot: this.state.lastRuntimeSnapshot,
					codeReviewScore: this.state.codeReviewScore,
				})
				await this.recordCanaryOutcome(false)
				this.state.lastUpdatedAt = new Date().toISOString()
				await this.syncArtifacts()
				return canaryCompletionBlocker
			}

			const missingPreCompletionArtifacts = await this.getMissingRequiredArtifacts(
				this.policyBundle?.qualityGates.finalization.requiredPreCompletionArtifacts ?? [],
			)
			if (missingPreCompletionArtifacts.length > 0) {
				const detail = `Missing artifacts: ${missingPreCompletionArtifacts.join(", ")}`
				await this.appendExecutionTrace({
					type: "evidence_gate_failed",
					taskId: this.context.taskId,
					timestamp: new Date().toISOString(),
					phase: this.state.phase,
					detail,
				})
				await this.writeReplayRecord("evidence_gate_failed", {
					missingPreCompletionArtifacts,
					effectiveWriteOps,
					effectiveCommandOps,
				})
				this.state.lastUpdatedAt = new Date().toISOString()
				await this.syncArtifacts()
				return `RPI evidence gate failed: ${detail}.`
			}

			this.completePhase("implementation")
			this.completePhase("verification")
			this.state.lastUpdatedAt = new Date().toISOString()
			await this.syncArtifacts()
			return undefined
		})
	}

	async markCompletionAccepted(): Promise<void> {
		await this.ensureInitialized()
		if (!this.state) {
			return
		}

		await this.queueWrite(async () => {
			if (!this.state) {
				return
			}

			this.completePhase("verification")
			this.state.phase = "done"
			this.completePhase("done")
			this.state.lastUpdatedAt = new Date().toISOString()
			this.appendProgress("Task completion accepted by user.")
			await this.appendExecutionTrace({
				type: "completion_accepted",
				taskId: this.context.taskId,
				timestamp: new Date().toISOString(),
				phase: "done",
			})
			await this.writeFinalSummaryFile()
			await this.syncArtifacts()
			const missingPostCompletionArtifacts = await this.getMissingRequiredArtifacts(
				this.policyBundle?.qualityGates.finalization.requiredPostCompletionArtifacts ?? [],
			)
			if (missingPostCompletionArtifacts.length > 0) {
				await this.appendFinding(
					"warn",
					`Post-completion artifacts missing: ${missingPostCompletionArtifacts.join(", ")}.`,
				)
			}
			await this.recordCanaryOutcome(true)

			// Save key findings to cross-task memory
			try {
				const taskSummary = this.state.taskSummary
				const tags = this.extractKeywordsForMemory(taskSummary)

				if (this.state.observationCount > 0) {
					await this.memory.remember({
						taskId: this.context.taskId,
						type: "pattern",
						content: `Completed: ${taskSummary} (${this.state.writeOps} writes, ${this.state.commandOps} cmds, strategy: ${this.state.strategy})`,
						tags,
						source: "completion",
					})
				}

				// Remember any correction patterns as pitfalls
				if (this.pendingCorrectionHint) {
					await this.memory.remember({
						taskId: this.context.taskId,
						type: "pitfall",
						content: this.pendingCorrectionHint.reasoning,
						tags,
						source: "correction",
					})
				}
				if (this.state.throttleMode !== "normal") {
					await this.memory.remember({
						taskId: this.context.taskId,
						type: "decision",
						content: `Runtime fallback used: ${this.state.throttleMode}. Snapshot=${JSON.stringify(this.state.lastRuntimeSnapshot ?? {})}`,
						tags,
						source: "completion",
					})
				}

				await this.memory.prune()
			} catch {
				// Memory is best-effort
			}

			this.notifyAutopilotEvent({
				status: "phase_changed",
				phase: "done",
				previousPhase: "verification",
				trigger: "completion_accepted",
			})
		})
	}

	private get taskDirName(): string {
		return this.context.taskId.replace(/[^a-zA-Z0-9._-]/g, "_")
	}

	private get baseDir(): string {
		return path.join(this.context.cwd, ".roo", "rpi", this.taskDirName)
	}

	private get legacyBaseDir(): string {
		return path.join(this.context.cwd, ".roo", "rpi")
	}

	private get controlDir(): string {
		return path.join(this.context.cwd, ".roo", "rpi", "_control")
	}

	private get canaryStatePath(): string {
		return path.join(this.controlDir, "canary_state.json")
	}

	private get statePath(): string {
		return path.join(this.baseDir, "state.json")
	}

	private get legacyStatePath(): string {
		return path.join(this.legacyBaseDir, "state.json")
	}

	private get taskPlanPath(): string {
		return path.join(this.baseDir, "task_plan.md")
	}

	private get legacyTaskPlanPath(): string {
		return path.join(this.legacyBaseDir, "task_plan.md")
	}

	private get findingsPath(): string {
		return path.join(this.baseDir, "findings.md")
	}

	private get legacyFindingsPath(): string {
		return path.join(this.legacyBaseDir, "findings.md")
	}

	private get progressPath(): string {
		return path.join(this.baseDir, "progress.md")
	}

	private get legacyProgressPath(): string {
		return path.join(this.legacyBaseDir, "progress.md")
	}

	private get executionTracePath(): string {
		return path.join(this.baseDir, "execution_trace.jsonl")
	}

	private get replayRecordPath(): string {
		return path.join(this.baseDir, "replay_record.json")
	}

	private get finalSummaryPath(): string {
		return path.join(this.baseDir, "final_summary.md")
	}

	private get relativeBaseDir(): string {
		return path.posix.join(".roo", "rpi", this.taskDirName)
	}

	private get relativeTaskPlanPath(): string {
		return path.posix.join(this.relativeBaseDir, "task_plan.md")
	}

	private get relativeFindingsPath(): string {
		return path.posix.join(this.relativeBaseDir, "findings.md")
	}

	private queueWrite(operation: () => Promise<void>): Promise<void> {
		this.ioQueue = this.ioQueue.then(operation, operation)
		return this.ioQueue
	}

	private queueRead<T>(operation: () => Promise<T>): Promise<T> {
		return this.ioQueue.then(operation, operation)
	}

	private classifyStrategy(taskText: string, mode: string): RpiStrategy {
		const normalizedMode = (mode || "").toLowerCase()
		if (normalizedMode === "ask") {
			return "quick"
		}
		if (normalizedMode === "orchestrator") {
			return "full"
		}

		const normalizedTask = taskText.toLowerCase()
		let score = 0

		if (normalizedTask.length > 500) {
			score += 2
		} else if (normalizedTask.length > 180) {
			score += 1
		}

		const complexityKeywords = [
			"architecture",
			"migration",
			"refactor",
			"workflow",
			"orchestr",
			"multi",
			"parallel",
			"end-to-end",
			"integration",
			"security",
		]

		if (complexityKeywords.some((keyword) => normalizedTask.includes(keyword))) {
			score += 2
		}

		if (normalizedMode === "architect" || normalizedMode === "debug") {
			score += 1
		}

		if (score >= 3) {
			return "full"
		}

		if (score >= 1) {
			return "standard"
		}

		return "quick"
	}

	private getRequiredPhases(strategy: RpiStrategy): RpiPhase[] {
		if (strategy === "quick") {
			return ["implementation", "verification"]
		}
		return ["discovery", "planning", "implementation", "verification"]
	}

	private heuristicDecompose(taskText: string, _mode: string): RpiTaskPlan {
		const steps: RpiTaskStep[] = []
		const normalized = taskText.toLowerCase()
		let stepId = 0
		const nextId = () => `s${++stepId}`

		const strategy = this.state?.strategy ?? "standard"

		// 1. Always: Understand context (unless quick)
		if (strategy !== "quick") {
			steps.push({
				id: nextId(),
				description: "Understand the relevant codebase context",
				status: "pending",
				phase: "discovery",
				toolsExpected: ["read_file", "search_files", "list_files"],
				toolsUsed: [],
				observationIds: [],
			})

			// If task mentions specific files, add a read step
			const fileRefs = this.extractFileReferences(taskText)
			if (fileRefs.length > 0) {
				steps.push({
					id: nextId(),
					description: `Read key files: ${fileRefs.slice(0, 5).join(", ")}`,
					status: "pending",
					phase: "discovery",
					toolsExpected: ["read_file"],
					toolsUsed: [],
					observationIds: [],
				})
			}

			// 2. Planning step for non-quick strategies
			steps.push({
				id: nextId(),
				description: "Plan the implementation approach",
				status: "pending",
				phase: "planning",
				toolsExpected: ["update_todo_list"],
				toolsUsed: [],
				observationIds: [],
			})
		}

		// 3. Implementation (based on keywords)
		if (
			normalized.includes("refactor") ||
			normalized.includes("fix") ||
			normalized.includes("implement") ||
			normalized.includes("add") ||
			normalized.includes("create") ||
			normalized.includes("update")
		) {
			steps.push({
				id: nextId(),
				description: "Implement the requested changes",
				status: strategy === "quick" ? "pending" : "pending",
				phase: "implementation",
				toolsExpected: ["write_to_file", "apply_diff", "execute_command"],
				toolsUsed: [],
				observationIds: [],
			})
		} else {
			// Generic implementation step
			steps.push({
				id: nextId(),
				description: "Execute the task",
				status: "pending",
				phase: "implementation",
				toolsUsed: [],
				observationIds: [],
			})
		}

		if (normalized.includes("test")) {
			steps.push({
				id: nextId(),
				description: "Write or update tests",
				status: "pending",
				phase: "implementation",
				toolsExpected: ["write_to_file", "execute_command"],
				toolsUsed: [],
				observationIds: [],
			})
		}

		// 4. Always: Verify
		steps.push({
			id: nextId(),
			description: "Verify changes work correctly",
			status: "pending",
			phase: "verification",
			toolsExpected: ["execute_command"],
			toolsUsed: [],
			observationIds: [],
		})

		// Mark first step as in_progress
		if (steps.length > 0) {
			steps[0].status = "in_progress"
		}

		return {
			version: 2,
			taskSummary: this.state?.taskSummary ?? this.summarizeTask(taskText),
			decompositionSource: "heuristic",
			steps,
			currentStepIndex: 0,
			lastUpdatedAt: new Date().toISOString(),
		}
	}

	/**
	 * AI-driven task decomposition using the council engine's structured_decompose action.
	 * Falls back to heuristic decomposition if AI fails.
	 */
	private async aiDecompose(taskText: string, mode: string): Promise<RpiTaskPlan> {
		const apiConfiguration = await this.context.getApiConfiguration()
		if (!apiConfiguration?.apiProvider) {
			return this.heuristicDecompose(taskText, mode)
		}

		const input = this.buildCouncilInput(mode)
		const result = await this.councilEngine.structuredDecompose(apiConfiguration, input)

		// Parse structured steps from the council result
		const rawResponse = result.rawResponse
		const parsed = this.tryParseJsonFromResponse(rawResponse)

		if (parsed?.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
			let stepId = 0
			const nextId = () => `s${++stepId}`

			const steps: RpiTaskStep[] = parsed.steps.slice(0, 15).map((s: any) => ({
				id: nextId(),
				description: typeof s.description === "string" ? s.description.slice(0, 200) : "Step",
				status: "pending" as const,
				phase: this.normalizePhase(s.phase),
				toolsExpected: Array.isArray(s.toolsExpected)
					? s.toolsExpected.filter((t: unknown) => typeof t === "string").slice(0, 5)
					: undefined,
				toolsUsed: [],
				observationIds: [],
			}))

			// Mark first step as in_progress
			if (steps.length > 0) {
				steps[0].status = "in_progress"
			}

			this.appendProgress("Task plan generated via AI decomposition.")

			return {
				version: 2,
				taskSummary: this.state?.taskSummary ?? this.summarizeTask(taskText),
				decompositionSource: "council",
				steps,
				currentStepIndex: 0,
				lastUpdatedAt: new Date().toISOString(),
			}
		}

		// Fallback if parsing failed
		return this.heuristicDecompose(taskText, mode)
	}

	private normalizePhase(phase: unknown): RpiPhase {
		if (typeof phase !== "string") return "implementation"
		const normalized = phase.toLowerCase()
		if (normalized === "discovery") return "discovery"
		if (normalized === "planning") return "planning"
		if (normalized === "implementation") return "implementation"
		if (normalized === "verification") return "verification"
		return "implementation"
	}

	/**
	 * Phase 5.1: Adaptive re-planning.
	 * Every N tool executions, evaluate whether the current plan is still relevant.
	 * If observations deviate significantly from the plan, trigger a re-plan.
	 */
	private lastReplanAt = 0

	private async maybeRevisePlan(): Promise<void> {
		if (!this.state || !this.taskPlan || !this.context.isCouncilEngineEnabled()) {
			return
		}

		const adaptivePolicy = this.policyBundle?.qualityGates.performance.adaptiveConcurrency
		const adaptiveWindow = adaptivePolicy?.evaluationWindow ?? DEFAULT_ADAPTIVE_WINDOW
		const replanInterval =
			this.state.throttleMode === "fallback"
				? adaptiveWindow * 2
				: this.state.throttleMode === "throttled"
					? adaptiveWindow + 2
					: DEFAULT_REPLAN_INTERVAL

		// Only check every N tool runs
		if (this.state.toolRuns - this.lastReplanAt < replanInterval) {
			return
		}

		// Don't replan if already in verification or done
		if (this.state.phase === "verification" || this.state.phase === "done") {
			return
		}

		// Check if recent observations indicate plan deviation
		const recentObs = this.state.observations.slice(-replanInterval)
		if (recentObs.length === 0) {
			return
		}
		const failureRate = recentObs.filter((o) => !o.success).length / recentObs.length

		// If failure rate is high or we have blocked steps, consider replanning
		const hasBlockedSteps = this.taskPlan.steps.some((s) => s.status === "blocked")

		const minFailureRateForReplan = adaptivePolicy?.failureRateThreshold ?? 0.4
		if (failureRate < minFailureRateForReplan && !hasBlockedSteps) {
			return
		}

		this.lastReplanAt = this.state.toolRuns

		try {
			const apiConfiguration = await this.context.getApiConfiguration()
			if (!apiConfiguration?.apiProvider) {
				return
			}

			const mode = (await this.context.getMode()) || this.state.modeAtStart
			const input = this.buildCouncilInput(mode)
			const result = await this.councilEngine.structuredDecompose(apiConfiguration, input)
			const parsed = this.tryParseJsonFromResponse(result.rawResponse)

			if (parsed?.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
				// Preserve completed steps, replace only pending/in_progress ones
				const completedSteps = this.taskPlan.steps.filter((s) => s.status === "completed")
				let stepId = completedSteps.length

				const newPendingSteps: RpiTaskStep[] = parsed.steps.slice(0, 10).map((s: any) => ({
					id: `s${++stepId}`,
					description: typeof s.description === "string" ? s.description.slice(0, 200) : "Step",
					status: "pending" as const,
					phase: this.normalizePhase(s.phase),
					toolsExpected: Array.isArray(s.toolsExpected)
						? s.toolsExpected.filter((t: unknown) => typeof t === "string").slice(0, 5)
						: undefined,
					toolsUsed: [],
					observationIds: [],
				}))

				// Mark first new step as in_progress
				if (newPendingSteps.length > 0) {
					newPendingSteps[0].status = "in_progress"
				}

				this.taskPlan.steps = [...completedSteps, ...newPendingSteps]
				this.taskPlan.currentStepIndex = completedSteps.length
				this.taskPlan.lastUpdatedAt = new Date().toISOString()
				this.appendProgress("Plan revised via adaptive re-planning.")
				await this.appendFinding("info", "Plan revised due to execution deviation.")
			}
		} catch {
			// Re-planning is best-effort
		}
	}

	private isCanaryEnabled(): boolean {
		return this.policyBundle?.qualityGates.rollout.canary.enabled ?? false
	}

	private async loadCanaryState(): Promise<void> {
		if (!this.isCanaryEnabled()) {
			this.canaryState = undefined
			return
		}

		await fs.mkdir(this.controlDir, { recursive: true })
		try {
			const content = await fs.readFile(this.canaryStatePath, "utf-8")
			const parsed = JSON.parse(content) as Partial<RpiCanaryState>
			if (
				parsed &&
				parsed.version === 1 &&
				typeof parsed.fingerprint === "string" &&
				(parsed.status === "active" || parsed.status === "stable" || parsed.status === "blocked")
			) {
				this.canaryState = {
					version: 1,
					fingerprint: parsed.fingerprint,
					status: parsed.status,
					sampleSize: Math.max(1, parsed.sampleSize ?? 1),
					samples: Math.max(0, parsed.samples ?? 0),
					failedSamples: Math.max(0, parsed.failedSamples ?? 0),
					lastUpdatedAt:
						typeof parsed.lastUpdatedAt === "string" ? parsed.lastUpdatedAt : new Date().toISOString(),
				}
			}
		} catch {
			// Missing or malformed canary state is treated as first-run.
		}
	}

	private async enforceCanaryFingerprint(): Promise<void> {
		if (!this.isCanaryEnabled()) {
			return
		}
		const canaryPolicy = this.policyBundle?.qualityGates.rollout.canary
		if (!canaryPolicy) {
			return
		}

		const fingerprint = await this.buildRolloutFingerprint()
		const needsReset =
			!this.canaryState ||
			this.canaryState.fingerprint !== fingerprint ||
			this.canaryState.sampleSize !== canaryPolicy.sampleSize

		if (!needsReset) {
			return
		}

		this.canaryState = {
			version: 1,
			fingerprint,
			status: "active",
			sampleSize: canaryPolicy.sampleSize,
			samples: 0,
			failedSamples: 0,
			lastUpdatedAt: new Date().toISOString(),
		}
		await this.saveCanaryState()
		await this.appendExecutionTrace({
			type: "canary_state_changed",
			taskId: this.context.taskId,
			timestamp: new Date().toISOString(),
			phase: this.state?.phase ?? "discovery",
			fingerprint,
			canaryStatus: "active",
			detail: "Canary fingerprint initialized.",
		})
	}

	private async buildRolloutFingerprint(): Promise<string> {
		const apiConfig = await this.context.getApiConfiguration()
		const provider = apiConfig?.apiProvider ?? "unknown-provider"
		const modelId = apiConfig ? (getModelId(apiConfig) ?? "unknown-model") : "unknown-model"
		return `${provider}::${modelId}`
	}

	private async saveCanaryState(): Promise<void> {
		if (!this.canaryState) {
			return
		}
		await fs.mkdir(this.controlDir, { recursive: true })
		await fs.writeFile(this.canaryStatePath, `${JSON.stringify(this.canaryState, null, "\t")}\n`, "utf-8")
	}

	private async recordCanaryOutcome(passed: boolean): Promise<void> {
		if (!this.isCanaryEnabled() || !this.canaryState) {
			return
		}
		if (passed && this.canaryOutcomeRecorded) {
			return
		}

		if (passed) {
			this.canaryOutcomeRecorded = true
		}
		const canaryPolicy = this.policyBundle?.qualityGates.rollout.canary
		if (!canaryPolicy) {
			return
		}

		this.canaryState.samples += 1
		if (!passed) {
			this.canaryState.failedSamples += 1
		}
		const failureRate = this.canaryState.samples > 0 ? this.canaryState.failedSamples / this.canaryState.samples : 0
		if (this.canaryState.samples >= this.canaryState.sampleSize) {
			this.canaryState.status = failureRate > canaryPolicy.maxFailureRate ? "blocked" : "stable"
		} else {
			this.canaryState.status = "active"
		}
		this.canaryState.lastUpdatedAt = new Date().toISOString()
		await this.saveCanaryState()
		await this.appendExecutionTrace({
			type: "canary_state_changed",
			taskId: this.context.taskId,
			timestamp: new Date().toISOString(),
			phase: this.state?.phase ?? "verification",
			fingerprint: this.canaryState.fingerprint,
			canaryStatus: this.canaryState.status,
			detail: `samples=${this.canaryState.samples}, failed=${this.canaryState.failedSamples}`,
		})
	}

	private getCanaryCompletionBlocker(): string | undefined {
		const canaryPolicy = this.policyBundle?.qualityGates.rollout.canary
		if (!canaryPolicy?.enabled || !this.state || !this.canaryState) {
			return undefined
		}
		if (this.canaryState.status === "stable") {
			return undefined
		}

		const snapshot = this.state.lastRuntimeSnapshot
		const failureRate = snapshot?.failureRate ?? 0
		const p95LatencyMs = snapshot?.p95LatencyMs ?? 0
		if (failureRate > canaryPolicy.maxFailureRate) {
			return `Canary failed: failure rate ${(failureRate * 100).toFixed(1)}% exceeds limit ${(canaryPolicy.maxFailureRate * 100).toFixed(1)}%.`
		}
		if (p95LatencyMs > canaryPolicy.maxP95LatencyMs) {
			return `Canary failed: p95 latency ${Math.round(p95LatencyMs)}ms exceeds limit ${canaryPolicy.maxP95LatencyMs}ms.`
		}
		const score = this.state.codeReviewScore
		if (typeof score === "number" && score < canaryPolicy.minCodeReviewScore) {
			return `Canary failed: code review score ${score}/10 is below minimum ${canaryPolicy.minCodeReviewScore}/10.`
		}
		return undefined
	}

	private getCostGuardrailCompletionBlocker(): string | undefined {
		const guardrails = this.policyBundle?.qualityGates.performance.costGuardrails
		if (!guardrails?.enabled) {
			return undefined
		}
		const liveCost = this.context.getTokenUsage?.()?.totalCost
		if (
			typeof liveCost === "number" &&
			(!this.state?.lastRuntimeSnapshot || this.state.lastRuntimeSnapshot.costUsd !== liveCost)
		) {
			const ratio = guardrails.maxTaskCostUsd > 0 ? liveCost / guardrails.maxTaskCostUsd : undefined
			if (this.state) {
				this.state.lastRuntimeSnapshot = {
					failureRate: this.state.lastRuntimeSnapshot?.failureRate ?? 0,
					p95LatencyMs: this.state.lastRuntimeSnapshot?.p95LatencyMs ?? 0,
					recentCount: this.state.lastRuntimeSnapshot?.recentCount ?? 0,
					costUsd: liveCost,
					costRatio: ratio,
				}
			}
		}
		const ratio = this.state?.lastRuntimeSnapshot?.costRatio
		const cost = this.state?.lastRuntimeSnapshot?.costUsd
		if (typeof ratio !== "number" || typeof cost !== "number") {
			return undefined
		}
		if (ratio >= guardrails.fallbackAtRatio) {
			return `RPI cost guardrail blocked completion: cost $${cost.toFixed(2)} is ${(ratio * 100).toFixed(0)}% of cap $${guardrails.maxTaskCostUsd.toFixed(2)}.`
		}
		return undefined
	}

	private getPercentile(values: number[], percentile: number): number {
		if (values.length === 0) {
			return 0
		}
		const sorted = [...values].sort((a, b) => a - b)
		const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1))
		return sorted[index]
	}

	private async evaluateAdaptiveRuntimeControls(): Promise<void> {
		if (!this.state) {
			return
		}

		const adaptivePolicy = this.policyBundle?.qualityGates.performance.adaptiveConcurrency
		const costPolicy = this.policyBundle?.qualityGates.performance.costGuardrails
		const evaluationWindow = adaptivePolicy?.evaluationWindow ?? DEFAULT_ADAPTIVE_WINDOW
		const recent = this.state.observations.slice(-evaluationWindow)
		if (recent.length === 0) {
			return
		}

		const failureRate = recent.filter((observation) => !observation.success).length / recent.length
		const latencySamples = recent
			.map((observation) => observation.durationMs)
			.filter((value): value is number => typeof value === "number" && value >= 0)
		const p95LatencyMs = latencySamples.length > 0 ? this.getPercentile(latencySamples, 95) : 0

		const totalCost = this.context.getTokenUsage?.()?.totalCost
		const costRatio =
			typeof totalCost === "number" && (costPolicy?.maxTaskCostUsd ?? 0) > 0
				? totalCost / (costPolicy?.maxTaskCostUsd ?? 1)
				: undefined

		const previousSnapshot = this.state.lastRuntimeSnapshot
		this.state.lastRuntimeSnapshot = {
			failureRate,
			p95LatencyMs,
			recentCount: recent.length,
			costUsd: typeof totalCost === "number" ? totalCost : undefined,
			costRatio,
		}

		let nextThrottleMode: RpiThrottleMode = "normal"
		if (adaptivePolicy?.enabled !== false) {
			if (
				failureRate >= (adaptivePolicy?.fallbackFailureRateThreshold ?? 0.6) ||
				p95LatencyMs >= (adaptivePolicy?.fallbackP95LatencyMsThreshold ?? 30_000)
			) {
				nextThrottleMode = "fallback"
			} else if (
				failureRate >= (adaptivePolicy?.failureRateThreshold ?? 0.35) ||
				p95LatencyMs >= (adaptivePolicy?.p95LatencyMsThreshold ?? 15_000)
			) {
				nextThrottleMode = "throttled"
			}
		}

		if (costPolicy?.enabled && typeof costRatio === "number") {
			if (costRatio >= costPolicy.fallbackAtRatio) {
				nextThrottleMode = "fallback"
			} else if (costRatio >= costPolicy.throttleAtRatio && nextThrottleMode === "normal") {
				nextThrottleMode = "throttled"
			}

			const previousRatio = previousSnapshot?.costRatio
			if (
				costRatio >= costPolicy.warnAtRatio &&
				(previousRatio === undefined || previousRatio < costPolicy.warnAtRatio)
			) {
				await this.appendExecutionTrace({
					type: "cost_guardrail_warned",
					taskId: this.context.taskId,
					timestamp: new Date().toISOString(),
					phase: this.state.phase,
					costUsd: totalCost,
					costRatio,
					throttleMode: nextThrottleMode,
					detail: `Cost ratio ${(costRatio * 100).toFixed(0)}% reached warning threshold.`,
				})
			}
		}

		if (this.state.throttleMode !== nextThrottleMode) {
			this.state.throttleMode = nextThrottleMode
			await this.appendExecutionTrace({
				type: "adaptive_throttle_changed",
				taskId: this.context.taskId,
				timestamp: new Date().toISOString(),
				phase: this.state.phase,
				throttleMode: nextThrottleMode,
				costUsd: typeof totalCost === "number" ? totalCost : undefined,
				costRatio,
				detail: `failureRate=${(failureRate * 100).toFixed(1)}%, p95=${Math.round(p95LatencyMs)}ms`,
			})
			this.appendProgress(
				`Adaptive runtime mode changed to ${nextThrottleMode} (failure ${(failureRate * 100).toFixed(1)}%, p95 ${Math.round(p95LatencyMs)}ms).`,
			)
		}
	}

	private tryParseJsonFromResponse(rawResponse: string): Record<string, unknown> | undefined {
		// Try direct parse
		try {
			const parsed = JSON.parse(rawResponse.trim())
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
				return parsed as Record<string, unknown>
			}
		} catch {
			// Try extracting from code fences
		}
		const fencedMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/i)
		if (fencedMatch?.[1]) {
			try {
				const parsed = JSON.parse(fencedMatch[1].trim())
				if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
					return parsed as Record<string, unknown>
				}
			} catch {
				// ignore
			}
		}
		return undefined
	}

	private extractKeywordsForMemory(text: string): string[] {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9\s_-]/g, " ")
			.split(/\s+/)
			.filter((w) => w.length > 2)
			.slice(0, 10)
	}

	private extractFileReferences(text: string): string[] {
		const filePattern =
			/(?:^|\s|[`"'(])([a-zA-Z0-9_\-./\\]+\.(?:ts|tsx|js|jsx|py|rs|go|java|css|html|json|md|yaml|yml|toml))\b/g
		const matches: string[] = []
		let match: RegExpExecArray | null
		while ((match = filePattern.exec(text)) !== null) {
			if (match[1] && !matches.includes(match[1])) {
				matches.push(match[1])
			}
		}
		return matches
	}

	private autoAdvanceStep(observation: RpiToolObservation): void {
		if (!this.taskPlan) {
			return
		}
		const current = this.taskPlan.steps[this.taskPlan.currentStepIndex]
		if (!current || current.status !== "in_progress") {
			return
		}

		// Record tool used and observation
		if (!current.toolsUsed.includes(observation.toolName)) {
			current.toolsUsed.push(observation.toolName)
		}
		current.observationIds.push(this.state?.observationCount ?? 0)

		// Heuristic step completion based on phase + tool combination
		if (observation.success && this.isStepLikelyComplete(current, observation)) {
			current.status = "completed"
			current.outcome = observation.summary
			this.taskPlan.currentStepIndex++
			this.taskPlan.lastUpdatedAt = new Date().toISOString()
			if (this.taskPlan.currentStepIndex < this.taskPlan.steps.length) {
				this.taskPlan.steps[this.taskPlan.currentStepIndex].status = "in_progress"
			}
		}
	}

	private isStepLikelyComplete(step: RpiTaskStep, observation: RpiToolObservation): boolean {
		const tool = observation.toolName

		switch (step.phase) {
			case "discovery":
				// Discovery steps complete after read/search/list tools
				return [
					"read_file",
					"search_files",
					"list_files",
					"codebase_search",
					"list_code_definition_names",
				].includes(tool)
			case "planning":
				// Planning completes after todo update or after any planning tool
				return ["update_todo_list", "ask_followup_question", "switch_mode"].includes(tool)
			case "implementation":
				// Implementation completes after a successful write
				return WRITE_TOOLS.has(tool) || tool === "execute_command"
			case "verification":
				// Verification completes after a successful command execution
				return tool === "execute_command"
			default:
				return false
		}
	}

	private createInitialState(mode: string, taskText: string): RpiState {
		const strategy = this.classifyStrategy(taskText, mode)
		const now = new Date().toISOString()
		return {
			version: 1,
			taskId: this.context.taskId,
			taskSummary: this.summarizeTask(taskText),
			modeAtStart: mode || "code",
			strategy,
			phase: strategy === "quick" ? "implementation" : "discovery",
			requiredPhases: this.getRequiredPhases(strategy),
			completedPhases: [],
			toolRuns: 0,
			writeOps: 0,
			commandOps: 0,
			notesCount: 0,
			councilTotalRuns: 0,
			councilRunsByPhase: {},
			lastUpdatedAt: now,
			createdAt: now,
			observations: [],
			observationCount: 0,
			stepAttempts: {},
			codeReviewRuns: 0,
			throttleMode: "normal",
		}
	}

	private normalizeState(state: RpiState): RpiState {
		return {
			...state,
			councilTotalRuns: state.councilTotalRuns ?? 0,
			councilRunsByPhase: state.councilRunsByPhase ?? {},
			observations: state.observations ?? [],
			observationCount: state.observationCount ?? 0,
			stepAttempts: state.stepAttempts ?? {},
			codeReviewRuns: state.codeReviewRuns ?? 0,
			throttleMode: state.throttleMode ?? "normal",
			lastRuntimeSnapshot: state.lastRuntimeSnapshot,
		}
	}

	private summarizeTask(taskText: string): string {
		const trimmed = (taskText || "").trim()
		if (!trimmed) {
			return "Task started without explicit text."
		}
		return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed
	}

	private collectModifiedFiles(): string[] {
		if (!this.state) {
			return []
		}
		const seen = new Set<string>()
		for (const obs of this.state.observations) {
			if (!obs.filesAffected) {
				continue
			}
			for (const filePath of obs.filesAffected) {
				if (!filePath) {
					continue
				}
				const ext = path.extname(filePath).toLowerCase()
				if (CODE_REVIEW_BINARY_EXTENSIONS.has(ext)) {
					continue
				}
				if (isRpiStateMutationPath(filePath)) {
					continue
				}
				seen.add(filePath)
			}
		}
		return Array.from(seen)
	}

	private async readFilesForReview(
		filePaths: string[],
		maxTotalChars: number = DEFAULT_CODE_REVIEW_MAX_FILE_CHARS,
	): Promise<{ path: string; content: string }[]> {
		if (filePaths.length === 0) {
			return []
		}
		const perFileLimit = Math.max(2000, Math.floor(maxTotalChars / filePaths.length))
		const results: { path: string; content: string }[] = []
		let totalChars = 0

		for (const filePath of filePaths) {
			if (totalChars >= maxTotalChars) {
				break
			}
			try {
				const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(this.context.cwd, filePath)
				let content = await fs.readFile(absolutePath, "utf-8")
				if (content.length > perFileLimit) {
					content = content.slice(0, perFileLimit) + "\n// ... truncated"
				}
				if (totalChars + content.length > maxTotalChars) {
					content = content.slice(0, maxTotalChars - totalChars) + "\n// ... truncated"
				}
				results.push({ path: filePath, content })
				totalChars += content.length
			} catch {
				// File deleted or inaccessible — skip silently
			}
		}
		return results
	}

	private async maybeRunCodeReview(): Promise<string | undefined> {
		if (!this.state) {
			return undefined
		}
		if (this.state.throttleMode === "fallback" && !this.isCanaryEnabled()) {
			return undefined
		}

		// Guard: council must be enabled and code review must be enabled
		if (!this.context.isCouncilEngineEnabled()) {
			return undefined
		}
		if (this.context.isCodeReviewEnabled && !this.context.isCodeReviewEnabled()) {
			return undefined
		}

		// Guard: only run once per task
		if (this.state.codeReviewRuns >= MAX_CODE_REVIEW_RUNS_PER_TASK) {
			return undefined
		}

		// Collect modified files
		const modifiedFiles = this.collectModifiedFiles()
		if (modifiedFiles.length === 0) {
			this.context.onCodeReviewEvent?.({ status: "skipped", error: "No modified files to review." })
			return undefined
		}

		// Read file contents
		const fileContents = await this.readFilesForReview(modifiedFiles)
		if (fileContents.length === 0) {
			this.context.onCodeReviewEvent?.({ status: "skipped", error: "Could not read any modified files." })
			return undefined
		}

		// Emit started event
		this.context.onCodeReviewEvent?.({ status: "started", filesCount: fileContents.length })

		const startTime = Date.now()
		try {
			const apiConfig = await this.context.getApiConfiguration()
			if (!apiConfig) {
				this.context.onCodeReviewEvent?.({ status: "skipped", error: "No API configuration available." })
				return undefined
			}

			const mode = (await this.context.getMode()) || this.state.modeAtStart
			const input: RpiCouncilInput = {
				taskSummary: this.state.taskSummary,
				taskText: this.context.getTaskText() ?? this.state.taskSummary,
				mode,
				strategy: this.state.strategy,
				maxPromptChars: DEFAULT_CODE_REVIEW_MAX_FILE_CHARS,
			}

			const result: RpiCodeReviewResult = await this.councilEngine.runCodeReview(
				apiConfig,
				input,
				fileContents,
				DEFAULT_CODE_REVIEW_TIMEOUT_MS,
			)

			const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)

			// Only count as a used review run if the LLM returned parseable JSON.
			// A JSON parse failure (score=1, issues=[]) should allow retry.
			const jsonParseFailed = result.issues.length === 0 && result.score === 1
			if (!jsonParseFailed) {
				this.state.codeReviewRuns++
			}
			this.state.codeReviewScore = result.score

			// Store findings as progress
			if (result.findings.length > 0) {
				this.appendProgress(`Code review findings: ${result.findings.join("; ")}`)
			}

			this.context.onCodeReviewEvent?.({
				status: "completed",
				filesCount: fileContents.length,
				score: result.score,
				issuesCount: result.issues.length,
				reviewMarkdown: result.reviewMarkdown,
				elapsedSeconds,
			})

			// Check threshold
			const threshold = this.context.getCodeReviewScoreThreshold?.() ?? 4
			if (result.score < threshold) {
				return (
					`RPI Senior Code Review: Score ${result.score}/10 (threshold: ${threshold}/10) — BLOCKED.\n\n` +
					`${result.reviewMarkdown}\n\n` +
					`Fix the issues above and try again.`
				)
			}

			return undefined
		} catch (error) {
			const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.context.onCodeReviewEvent?.({
				status: "skipped",
				error: errorMessage,
				elapsedSeconds,
			})
			// LLM error does not block completion
			return undefined
		}
	}

	private completePhase(phase: RpiPhase): void {
		if (!this.state) {
			return
		}
		if (!this.state.requiredPhases.includes(phase) && phase !== "done") {
			return
		}
		if (!this.state.completedPhases.includes(phase)) {
			this.state.completedPhases.push(phase)
		}
	}

	private applyAutomaticPhaseTransition(toolName: string): void {
		if (!this.state) {
			return
		}

		if (this.state.phase === "done") {
			return
		}

		const strategy = this.state.strategy

		if (toolName === "attempt_completion") {
			if (this.state.phase !== "verification") {
				this.completePhase(this.state.phase)
				this.state.phase = "verification"
			}
			return
		}

		if (strategy !== "quick" && PLANNING_TOOLS.has(toolName) && this.state.phase === "discovery") {
			this.completePhase("discovery")
			this.state.phase = "planning"
			return
		}

		if (IMPLEMENTATION_TOOLS.has(toolName)) {
			if (strategy !== "quick") {
				this.completePhase("discovery")
				this.completePhase("planning")
			}
			this.state.phase = "implementation"
		}
	}

	private async maybeRunCouncilForPhase(
		phase: RpiPhase,
		trigger: "phase_change" | "completion_attempt" | "complexity_threshold",
	): Promise<void> {
		if (!this.state || !this.context.isCouncilEngineEnabled()) {
			return
		}

		if (!COUNCIL_PHASES.includes(phase as RpiCouncilPhase)) {
			return
		}

		const councilPhase = phase as RpiCouncilPhase
		if (this.state.throttleMode === "fallback" && councilPhase !== "verification") {
			return
		}
		if (this.state.throttleMode === "throttled" && trigger === "complexity_threshold") {
			return
		}
		if (this.state.councilTotalRuns >= MAX_COUNCIL_RUNS_PER_TASK) {
			return
		}
		if (this.getCouncilPhaseRunCount(councilPhase) >= MAX_COUNCIL_RUNS_PER_PHASE) {
			return
		}

		const mode = (await this.context.getMode()) || this.state.modeAtStart
		if (!this.shouldRunCouncilForPhase(councilPhase, mode, trigger)) {
			return
		}

		const apiConfiguration = await this.context.getApiConfiguration()
		if (!apiConfiguration?.apiProvider) {
			return
		}

		const input = this.buildCouncilInput(mode)
		const startTime = Date.now()
		this.notifyCouncilEvent({
			phase: councilPhase,
			trigger,
			status: "started",
			elapsedSeconds: 0,
		})
		const stopHeartbeat = this.startCouncilHeartbeat(councilPhase, trigger, startTime)
		try {
			let result: RpiCouncilResult
			if (councilPhase === "discovery") {
				result = await this.councilEngine.analyzeContext(apiConfiguration, input)
			} else if (councilPhase === "planning") {
				await this.councilEngine.decomposeTask(apiConfiguration, input)
				result = await this.councilEngine.buildDecision(apiConfiguration, input)
			} else {
				result = await this.councilEngine.runVerificationReview(apiConfiguration, input)
			}

			this.markCouncilRun(councilPhase)
			this.state.lastUpdatedAt = new Date().toISOString()
			this.state.notesCount += 1
			await this.appendFinding("info", `Council ${councilPhase}: ${result.summary}`)
			for (const finding of result.findings.slice(0, MAX_COUNCIL_FINDINGS)) {
				await this.appendFinding("info", `Council ${councilPhase} finding: ${finding}`)
			}
			for (const risk of result.risks.slice(0, MAX_COUNCIL_RISKS)) {
				await this.appendFinding("warn", `Council ${councilPhase} risk: ${risk}`)
			}
			this.appendProgress(`Council ${councilPhase} run completed (${trigger}).`)
			this.notifyCouncilEvent({
				phase: councilPhase,
				trigger,
				status: "completed",
				summary: result.summary,
				elapsedSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			await this.appendFinding("warn", `Council ${councilPhase} skipped: ${message}`)
			this.appendProgress(`Council ${councilPhase} run skipped (${trigger}).`)
			this.notifyCouncilEvent({
				phase: councilPhase,
				trigger,
				status: "skipped",
				error: message,
				elapsedSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
			})
		} finally {
			stopHeartbeat()
		}
	}

	private notifyCouncilEvent(event: {
		phase: RpiCouncilPhase
		trigger: "phase_change" | "completion_attempt" | "complexity_threshold"
		status: "started" | "heartbeat" | "completed" | "skipped"
		summary?: string
		error?: string
		elapsedSeconds?: number
	}): void {
		try {
			this.context.onCouncilEvent?.(event)
		} catch (error) {
			console.error(
				`[RpiAutopilot] Failed to notify council event: ${(error as Error)?.message ?? String(error)}`,
			)
		}
	}

	private notifyAutopilotEvent(event: {
		status: "initialized" | "phase_changed"
		phase: RpiPhase
		previousPhase?: RpiPhase
		trigger?: string
	}): void {
		try {
			this.context.onAutopilotEvent?.(event)
		} catch (error) {
			console.error(
				`[RpiAutopilot] Failed to notify autopilot event: ${(error as Error)?.message ?? String(error)}`,
			)
		}
	}

	private startCouncilHeartbeat(
		phase: RpiCouncilPhase,
		trigger: "phase_change" | "completion_attempt" | "complexity_threshold",
		startTime: number,
	): () => void {
		const heartbeatIntervalMs = 15_000
		const initialDelayMs = 15_000
		let isCleared = false

		let intervalId: ReturnType<typeof setInterval> | undefined
		const timeoutId = setTimeout(() => {
			if (isCleared) {
				return
			}
			const elapsedSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000))
			this.notifyCouncilEvent({
				phase,
				trigger,
				status: "heartbeat",
				elapsedSeconds,
			})
			intervalId = setInterval(() => {
				const intervalElapsedSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000))
				this.notifyCouncilEvent({
					phase,
					trigger,
					status: "heartbeat",
					elapsedSeconds: intervalElapsedSeconds,
				})
			}, heartbeatIntervalMs)
		}, initialDelayMs)

		return () => {
			isCleared = true
			if (intervalId) {
				clearInterval(intervalId)
			}
			clearTimeout(timeoutId)
		}
	}

	private shouldRunVerificationCouncil(mode: string, hasImplementationEvidence: boolean): boolean {
		const normalizedMode = (mode || "").toLowerCase()
		if (!MODES_REQUIRING_IMPLEMENTATION_EVIDENCE.has(normalizedMode)) {
			return false
		}
		return hasImplementationEvidence
	}

	private shouldRunCouncilForPhase(
		phase: RpiCouncilPhase,
		mode: string,
		trigger: "phase_change" | "completion_attempt" | "complexity_threshold",
	): boolean {
		const normalizedMode = (mode || "").toLowerCase()
		if (normalizedMode === "ask") {
			return false
		}

		if (phase === "discovery") {
			return this.hasComplexitySignal()
		}

		if (phase === "planning") {
			return this.state?.strategy !== "quick" || MODES_WITH_HIGH_COUNCIL_SENSITIVITY.has(normalizedMode)
		}

		if (phase === "verification") {
			if (trigger !== "completion_attempt" && trigger !== "phase_change") {
				return false
			}
			return this.state
				? this.shouldRunVerificationCouncil(
						normalizedMode,
						this.state.writeOps > 0 || this.state.commandOps > 0,
					)
				: false
		}

		return false
	}

	private hasComplexitySignal(): boolean {
		if (!this.state) {
			return false
		}

		const mode = (this.state.modeAtStart || "").toLowerCase()
		if (this.state.strategy === "full") {
			return true
		}
		if (MODES_WITH_HIGH_COUNCIL_SENSITIVITY.has(mode) && this.state.strategy !== "quick") {
			return true
		}

		const taskText = (this.context.getTaskText() || "").toLowerCase()
		if (taskText.length > 240) {
			return true
		}

		const complexityKeywords = [
			"architecture",
			"refactor",
			"migration",
			"integration",
			"multi-step",
			"workflow",
			"security",
		]
		return complexityKeywords.some((keyword) => taskText.includes(keyword))
	}

	private getCouncilPhaseRunCount(phase: RpiCouncilPhase): number {
		if (!this.state) {
			return 0
		}
		return this.state.councilRunsByPhase[phase] ?? 0
	}

	private markCouncilRun(phase: RpiCouncilPhase): void {
		if (!this.state) {
			return
		}
		this.state.councilRunsByPhase[phase] = this.getCouncilPhaseRunCount(phase) + 1
		this.state.councilTotalRuns += 1
	}

	private buildCouncilInput(mode: string): RpiCouncilInput {
		return {
			taskSummary: this.state?.taskSummary ?? "",
			taskText: this.context.getTaskText() ?? "",
			mode: mode || this.state?.modeAtStart || "code",
			strategy: this.state?.strategy ?? "quick",
			maxPromptChars: DEFAULT_COUNCIL_PROMPT_MAX_CHARS,
		}
	}

	private async readStateFile(): Promise<RpiState | undefined> {
		try {
			const content = await fs.readFile(this.statePath, "utf-8")
			const parsed = JSON.parse(content) as Partial<RpiState>
			if (!parsed || typeof parsed !== "object") {
				return undefined
			}
			if (parsed.version !== 1 || !parsed.taskId || !parsed.strategy || !parsed.phase) {
				return undefined
			}
			return parsed as RpiState
		} catch {
			return undefined
		}
	}

	private async readLegacyStateFile(): Promise<RpiState | undefined> {
		try {
			const content = await fs.readFile(this.legacyStatePath, "utf-8")
			const parsed = JSON.parse(content) as Partial<RpiState>
			if (!parsed || typeof parsed !== "object") {
				return undefined
			}
			if (parsed.version !== 1 || !parsed.taskId || !parsed.strategy || !parsed.phase) {
				return undefined
			}
			return parsed as RpiState
		} catch {
			return undefined
		}
	}

	private getExternalStatePath(taskId: string): string {
		const taskDirName = taskId.replace(/[^a-zA-Z0-9._-]/g, "_")
		return path.join(this.context.cwd, ".roo", "rpi", taskDirName, "state.json")
	}

	private async tryLoadExternalEvidence(taskId: string): Promise<
		| {
				observations: RpiToolObservation[]
				writeOps: number
				commandOps: number
		  }
		| undefined
	> {
		try {
			const statePath = this.getExternalStatePath(taskId)
			const content = await fs.readFile(statePath, "utf-8")
			const parsed = JSON.parse(content) as Partial<RpiState>
			if (!parsed || typeof parsed !== "object") {
				return undefined
			}
			if (parsed.version !== 1) {
				return undefined
			}

			return {
				observations: Array.isArray(parsed.observations) ? (parsed.observations as RpiToolObservation[]) : [],
				writeOps: typeof parsed.writeOps === "number" ? parsed.writeOps : 0,
				commandOps: typeof parsed.commandOps === "number" ? parsed.commandOps : 0,
			}
		} catch {
			return undefined
		}
	}

	private async maybeMigrateLegacyArtifacts(): Promise<void> {
		const copyIfMissing = async (source: string, destination: string) => {
			try {
				await fs.access(destination)
				return
			} catch {
				// destination missing, continue
			}

			try {
				await fs.copyFile(source, destination)
			} catch {
				// ignore missing legacy artifacts
			}
		}

		await Promise.all([
			copyIfMissing(this.legacyTaskPlanPath, this.taskPlanPath),
			copyIfMissing(this.legacyFindingsPath, this.findingsPath),
			copyIfMissing(this.legacyProgressPath, this.progressPath),
		])
	}

	private classifyToolRisk(toolName: string, mcpToolName?: string): RpiRiskClass {
		if (!this.policyBundle) {
			return "R1"
		}
		return classifyRpiToolRisk(this.policyBundle.riskMatrix, { toolName, mcpToolName })
	}

	private async appendExecutionTrace(event: RpiTraceEvent): Promise<void> {
		await fs.appendFile(this.executionTracePath, `${JSON.stringify(event)}\n`, "utf-8")
	}

	private async readRecentTraceEvents(limit: number): Promise<RpiTraceEvent[]> {
		try {
			const content = await fs.readFile(this.executionTracePath, "utf-8")
			const lines = content
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line.length > 0)
			const selected = lines.slice(-Math.max(1, limit))
			const parsed: RpiTraceEvent[] = []
			for (const line of selected) {
				try {
					parsed.push(JSON.parse(line) as RpiTraceEvent)
				} catch {
					// Ignore malformed trace line
				}
			}
			return parsed
		} catch {
			return []
		}
	}

	private async writeReplayRecord(
		reason:
			| "verification_failed"
			| "code_review_blocked"
			| "evidence_gate_failed"
			| "cost_guardrail_blocked"
			| "canary_gate_failed",
		payload: Record<string, unknown>,
	): Promise<void> {
		if (!this.state) {
			return
		}

		const includeRecentObservations = this.policyBundle?.qualityGates.replay.includeRecentObservations ?? 10
		const includeRecentTraceEvents = this.policyBundle?.qualityGates.replay.includeRecentTraceEvents ?? 25
		const replayRecord = {
			version: 1,
			reason,
			taskId: this.context.taskId,
			phase: this.state.phase,
			timestamp: new Date().toISOString(),
			state: {
				strategy: this.state.strategy,
				toolRuns: this.state.toolRuns,
				writeOps: this.state.writeOps,
				commandOps: this.state.commandOps,
				observationCount: this.state.observationCount,
				lastUpdatedAt: this.state.lastUpdatedAt,
				throttleMode: this.state.throttleMode,
				lastRuntimeSnapshot: this.state.lastRuntimeSnapshot,
			},
			taskText: this.context.getTaskText() ?? "",
			canaryState: this.canaryState,
			recentObservations: this.state.observations.slice(-Math.max(1, includeRecentObservations)),
			recentTraceEvents: await this.readRecentTraceEvents(includeRecentTraceEvents),
			payload,
		}

		await fs.writeFile(this.replayRecordPath, `${JSON.stringify(replayRecord, null, "\t")}\n`, "utf-8")
	}

	private async writeFinalSummaryFile(): Promise<void> {
		if (!this.state) {
			return
		}

		const lines = [
			"# RPI Final Summary",
			"",
			`- Task: ${this.state.taskSummary}`,
			`- Task ID: ${this.context.taskId}`,
			`- Strategy: ${this.state.strategy}`,
			`- Final phase: ${this.state.phase}`,
			`- Runtime mode: ${this.state.throttleMode}`,
			`- Tool runs: ${this.state.toolRuns}`,
			`- Writes: ${this.state.writeOps}`,
			`- Commands: ${this.state.commandOps}`,
			`- Observations: ${this.state.observationCount}`,
			`- Last updated: ${this.state.lastUpdatedAt}`,
			`- Total cost (USD): ${
				typeof this.state.lastRuntimeSnapshot?.costUsd === "number"
					? this.state.lastRuntimeSnapshot.costUsd.toFixed(4)
					: "n/a"
			}`,
			`- Canary: ${
				this.canaryState
					? `${this.canaryState.status} (${this.canaryState.samples}/${this.canaryState.sampleSize})`
					: "disabled"
			}`,
			"",
			"## Evidence",
			"- state.json",
			"- task_plan.md",
			"- findings.md",
			"- progress.md",
			"- execution_trace.jsonl",
			"",
			"## Postmortem",
			`- Failure rate (recent): ${((this.state.lastRuntimeSnapshot?.failureRate ?? 0) * 100).toFixed(1)}%`,
			`- P95 latency (recent): ${Math.round(this.state.lastRuntimeSnapshot?.p95LatencyMs ?? 0)}ms`,
			"",
		]

		await fs.writeFile(this.finalSummaryPath, lines.join("\n"), "utf-8")
	}

	private async getMissingRequiredArtifacts(requiredArtifacts: string[]): Promise<string[]> {
		if (requiredArtifacts.length === 0) {
			return []
		}

		const missing: string[] = []
		for (const artifact of requiredArtifacts) {
			const resolvedPath = path.isAbsolute(artifact) ? artifact : path.join(this.baseDir, artifact)
			try {
				await fs.access(resolvedPath)
			} catch {
				missing.push(artifact)
			}
		}
		return missing
	}

	private async appendFinding(level: RpiEventLevel, message: string): Promise<void> {
		const timestamp = new Date().toISOString()
		const line = `- [${timestamp}] [${level.toUpperCase()}] ${message}\n`
		await fs.appendFile(this.findingsPath, line, "utf-8")
	}

	private appendProgress(message: string): void {
		const timestamp = new Date().toISOString().slice(11, 19) // HH:MM:SS
		this.progressEvents.push(`[${timestamp}] ${message}`)
		if (this.progressEvents.length > MAX_PROGRESS_EVENTS) {
			this.progressEvents.shift()
		}
	}

	getProgressSummary(): string {
		if (!this.state) {
			return ""
		}
		const { phase, strategy, toolRuns, writeOps, commandOps, observationCount } = this.state
		const lastObs = this.state.lastObservation
		const parts = [
			`Phase: ${phase}`,
			`Strategy: ${strategy}`,
			`Tools: ${toolRuns} runs`,
			`Writes: ${writeOps}`,
			`Commands: ${commandOps}`,
			`Observations: ${observationCount}`,
		]
		if (lastObs) {
			parts.push(`Last: ${lastObs.summary}`)
		}
		return parts.join(" | ")
	}

	private async writeProgressFile(): Promise<void> {
		if (!this.state) {
			return
		}

		const { phase, strategy, toolRuns, writeOps, commandOps, observationCount, councilTotalRuns } = this.state

		const lines: string[] = [
			"# RPI Progress",
			"",
			"## Summary",
			`- Task: ${this.state.taskSummary}`,
			`- Strategy: ${strategy} | Phase: ${phase}`,
			`- Tools: ${toolRuns} runs | Writes: ${writeOps} | Commands: ${commandOps} | Observations: ${observationCount}`,
			`- Council runs: ${councilTotalRuns}`,
		]

		if (this.state.lastObservation) {
			lines.push(`- Last result: ${this.state.lastObservation.summary}`)
		}

		lines.push("", "## Event Log")

		if (this.progressEvents.length === 0) {
			lines.push("- (no events yet)")
		} else {
			for (const event of this.progressEvents) {
				lines.push(`- ${event}`)
			}
		}

		lines.push("")
		await fs.writeFile(this.progressPath, lines.join("\n"), "utf-8")
	}

	private async syncArtifacts(): Promise<void> {
		if (!this.state) {
			return
		}
		// ensureArtifactHeaders must run first (creates files if missing)
		await this.ensureArtifactHeaders()
		// Write state, plan, and progress in parallel (independent files)
		await Promise.all([this.writeStateFile(), this.writeTaskPlanFile(), this.writeProgressFile()])
	}

	private async ensureArtifactHeaders(): Promise<void> {
		await this.ensureFileWithHeader(
			this.findingsPath,
			"# RPI Findings\n\nAuto-managed durable findings log.\n\n## Entries\n",
		)
		await this.ensureFileWithHeader(this.executionTracePath, "")
	}

	private async ensureFileWithHeader(filePath: string, header: string): Promise<void> {
		try {
			await fs.access(filePath)
		} catch {
			await fs.writeFile(filePath, header, "utf-8")
		}
	}

	private async writeStateFile(): Promise<void> {
		if (!this.state) {
			return
		}
		await fs.writeFile(this.statePath, `${JSON.stringify(this.state, null, "\t")}\n`, "utf-8")
	}

	private async writeTaskPlanFile(): Promise<void> {
		if (!this.state) {
			return
		}

		const plan = this.taskPlan
		const completedSteps = plan?.steps.filter((s) => s.status === "completed").length ?? 0
		const totalSteps = plan?.steps.length ?? 0

		const lines: string[] = [
			"# RPI Task Plan",
			"",
			`- Task: ${this.state.taskSummary}`,
			`- Strategy: ${this.state.strategy} | Phase: ${this.state.phase} | Steps: ${completedSteps}/${totalSteps}`,
			`- Council runs: ${this.state.councilTotalRuns}`,
			`- Last update: ${this.state.lastUpdatedAt}`,
		]

		if (plan && plan.steps.length > 0) {
			lines.push("", "## Steps")
			for (let i = 0; i < plan.steps.length; i++) {
				const step = plan.steps[i]
				const mark = step.status === "completed" ? "x" : step.status === "in_progress" ? "-" : " "
				const phaseTag = `(${step.phase})`
				let line = `- [${mark}] ${i + 1}. ${step.description} ${phaseTag}`
				if (step.outcome) {
					line += `\n       Outcome: ${step.outcome}`
				}
				if (step.toolsUsed.length > 0) {
					line += `\n       Tools: ${step.toolsUsed.join(", ")}`
				}
				lines.push(line)
			}
		}

		lines.push(
			"",
			"## Flow Rules",
			"- Keep implementation and decisions synchronized with the current phase.",
			"- Persist durable knowledge in findings and progress files.",
			"- Keep execution_trace.jsonl updated for replay and auditability.",
			"- Completion is allowed only after verification gate succeeds.",
			"",
		)

		await fs.writeFile(this.taskPlanPath, lines.join("\n"), "utf-8")
	}
}
