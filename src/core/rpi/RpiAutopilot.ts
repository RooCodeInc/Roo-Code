import fs from "fs/promises"
import * as path from "path"
import type { ProviderSettings } from "@roo-code/types"

import { type RpiCouncilResult, RpiCouncilEngine, type RpiCouncilInput } from "./engine/RpiCouncilEngine"
import { RpiCorrectionEngine, type RpiCorrectionSuggestion } from "./engine/RpiCorrectionEngine"
import { RpiVerificationEngine } from "./engine/RpiVerificationEngine"
import { RpiMemory } from "./RpiMemory"

type RpiStrategy = "quick" | "standard" | "full"
type RpiPhase = "discovery" | "planning" | "implementation" | "verification" | "done"
type RpiCouncilPhase = Exclude<RpiPhase, "implementation" | "done">

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
}

interface RpiAutopilotContext {
	taskId: string
	cwd: string
	getMode: () => Promise<string>
	getTaskText: () => string | undefined
	getApiConfiguration: () => Promise<ProviderSettings | undefined>
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

export class RpiAutopilot {
	private state?: RpiState
	private initialized = false
	private ioQueue: Promise<void> = Promise.resolve()
	private readonly councilEngine: RpiCouncilEngine
	private readonly correctionEngine: RpiCorrectionEngine
	private readonly verificationEngine: RpiVerificationEngine
	private readonly memory: RpiMemory
	private progressEvents: string[] = []
	private taskPlan?: RpiTaskPlan
	private pendingCorrectionHint?: RpiCorrectionSuggestion

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

			// Initialize dynamic task plan if not yet created
			if (!this.taskPlan && this.state) {
				this.taskPlan = this.heuristicDecompose(taskText, mode)
			}

			// Recall relevant memories from cross-task memory
			if (taskText) {
				try {
					const memories = await this.memory.recall(taskText)
					if (memories.length > 0) {
						for (const mem of memories) {
							this.appendProgress(`Memory recalled [${mem.type}]: ${mem.content}`)
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
		lines.push(`Plan: ${this.relativeTaskPlanPath}. Notes: ${this.relativeFindingsPath}.`)

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
			this.state.lastTool = toolName
			this.state.lastToolAt = new Date().toISOString()
			this.state.lastUpdatedAt = new Date().toISOString()

			const mcpToolName =
				toolName === "use_mcp_tool" && typeof params?.tool_name === "string" ? params.tool_name : undefined
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

			// Store observation in rolling window
			this.state.observations.push(observation)
			if (this.state.observations.length > MAX_OBSERVATIONS) {
				this.state.observations.shift()
			}
			this.state.lastObservation = observation
			this.state.observationCount += 1

			// Rich progress logging based on observation
			if (!observation.success) {
				this.appendProgress(`Tool \`${toolName}\` FAILED → ${observation.summary}`)
				await this.appendFinding(
					"error",
					`Tool \`${toolName}\` failed: ${observation.error ?? observation.summary}`,
				)
			} else if (IMPLEMENTATION_TOOLS.has(toolName) || PLANNING_TOOLS.has(toolName)) {
				this.appendProgress(`Tool \`${toolName}\` → ${observation.summary}`)
			}

			// Correction engine: analyze failures and suggest next action
			if (!observation.success) {
				const stepKey = this.taskPlan?.steps[this.taskPlan.currentStepIndex]?.id ?? toolName
				this.state.stepAttempts[stepKey] = (this.state.stepAttempts[stepKey] ?? 0) + 1

				const correction = this.correctionEngine.analyze({
					failedToolName: toolName,
					errorMessage: observation.error ?? "Unknown error",
					observation,
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
			this.autoAdvanceStep(observation)

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

			// Run verification engine with quality gates
			const strictness = this.context.getVerificationStrictness?.() ?? "lenient"
			const verification = this.verificationEngine.evaluate({
				observations: effectiveObservations,
				taskText: this.context.getTaskText() ?? "",
				mode: currentMode,
				strictness,
				writeOps: effectiveWriteOps,
				commandOps: effectiveCommandOps,
			})

			if (!verification.passed) {
				const failed = verification.checks
					.filter((c) => c.status === "failed")
					.map((c) => `- ${c.name}: ${c.detail}`)
					.join("\n")
				this.state.lastUpdatedAt = new Date().toISOString()
				await this.syncArtifacts()
				return `RPI verification failed:\n${failed}\n\nSuggestions:\n${verification.suggestions.join("\n")}`
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
			await this.syncArtifacts()

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
		}
	}

	private summarizeTask(taskText: string): string {
		const trimmed = (taskText || "").trim()
		if (!trimmed) {
			return "Task started without explicit text."
		}
		return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed
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
		await this.ensureArtifactHeaders()
		await this.writeStateFile()
		await this.writeTaskPlanFile()
		await this.writeProgressFile()
	}

	private async ensureArtifactHeaders(): Promise<void> {
		await this.ensureFileWithHeader(
			this.findingsPath,
			"# RPI Findings\n\nAuto-managed durable findings log.\n\n## Entries\n",
		)
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
			"- Completion is allowed only after verification gate succeeds.",
			"",
		)

		await fs.writeFile(this.taskPlanPath, lines.join("\n"), "utf-8")
	}
}
