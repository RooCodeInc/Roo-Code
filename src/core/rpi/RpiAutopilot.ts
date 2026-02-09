import fs from "fs/promises"
import * as path from "path"
import type { ProviderSettings } from "@roo-code/types"

import { type RpiCouncilResult, RpiCouncilEngine, type RpiCouncilInput } from "./engine/RpiCouncilEngine"

type RpiStrategy = "quick" | "standard" | "full"
type RpiPhase = "discovery" | "planning" | "implementation" | "verification" | "done"
type RpiCouncilPhase = Exclude<RpiPhase, "implementation" | "done">

type RpiEventLevel = "info" | "warn" | "error"

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
}

interface RpiAutopilotContext {
	taskId: string
	cwd: string
	getMode: () => Promise<string>
	getTaskText: () => string | undefined
	getApiConfiguration: () => ProviderSettings | undefined
	isCouncilEngineEnabled: () => boolean
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

	constructor(
		private readonly context: RpiAutopilotContext,
		councilEngine?: RpiCouncilEngine,
	) {
		this.councilEngine = councilEngine ?? new RpiCouncilEngine()
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
				this.state = this.createInitialState(mode, taskText)
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

		const completed = this.state.completedPhases.join(", ") || "none"
		return [
			"RPI autopilot is active and auto-managed.",
			`Current strategy: ${this.state.strategy}.`,
			`Current phase: ${this.state.phase}.`,
			`Completed phases: ${completed}.`,
			`Council engine: ${this.context.isCouncilEngineEnabled() ? "enabled" : "disabled"}.`,
			`Before major decisions, align with ${this.relativeTaskPlanPath}.`,
			`Keep durable notes in ${this.relativeFindingsPath} and ${this.relativeProgressPath}.`,
		].join(" ")
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

			if (WRITE_TOOLS.has(toolName)) {
				this.state.writeOps += 1
			}

			if (COMMAND_TOOLS.has(toolName)) {
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

			if (params?.path && typeof params.path === "string" && WRITE_TOOLS.has(toolName)) {
				await this.appendProgress(`Tool \`${toolName}\` started on \`${params.path}\`.`)
			} else if (IMPLEMENTATION_TOOLS.has(toolName)) {
				await this.appendProgress(`Tool \`${toolName}\` started.`)
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

	async onToolFinish(toolName: string, error?: Error): Promise<void> {
		await this.ensureInitialized()
		if (!this.state) {
			return
		}

		await this.queueWrite(async () => {
			if (!this.state) {
				return
			}

			this.state.lastUpdatedAt = new Date().toISOString()

			if (error) {
				await this.appendProgress(`Tool \`${toolName}\` failed: ${error.message}`)
				await this.appendFinding("error", `Tool \`${toolName}\` failed: ${error.message}`)
			} else if (IMPLEMENTATION_TOOLS.has(toolName) || PLANNING_TOOLS.has(toolName)) {
				await this.appendProgress(`Tool \`${toolName}\` completed successfully.`)
			}

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
			const requiresImplementationEvidence = MODES_REQUIRING_IMPLEMENTATION_EVIDENCE.has(currentMode)
			const hasImplementationEvidence = this.state.writeOps > 0 || this.state.commandOps > 0

			if (this.shouldRunVerificationCouncil(currentMode, hasImplementationEvidence)) {
				await this.maybeRunCouncilForPhase("verification", "completion_attempt")
			}

			if (requiresImplementationEvidence && !hasImplementationEvidence) {
				this.state.lastUpdatedAt = new Date().toISOString()
				await this.syncArtifacts()
				return `RPI autopilot blocked completion: no implementation evidence yet. Continue with code or command execution before finishing.`
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
			await this.appendProgress("Task completion accepted by user.")
			await this.syncArtifacts()
			this.notifyAutopilotEvent({
				status: "phase_changed",
				phase: "done",
				previousPhase: "verification",
				trigger: "completion_accepted",
			})
		})
	}

	private get baseDir(): string {
		return path.join(this.context.cwd, ".roo", "rpi")
	}

	private get statePath(): string {
		return path.join(this.baseDir, "state.json")
	}

	private get taskPlanPath(): string {
		return path.join(this.baseDir, "task_plan.md")
	}

	private get findingsPath(): string {
		return path.join(this.baseDir, "findings.md")
	}

	private get progressPath(): string {
		return path.join(this.baseDir, "progress.md")
	}

	private get relativeTaskPlanPath(): string {
		return ".roo/rpi/task_plan.md"
	}

	private get relativeFindingsPath(): string {
		return ".roo/rpi/findings.md"
	}

	private get relativeProgressPath(): string {
		return ".roo/rpi/progress.md"
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
		}
	}

	private normalizeState(state: RpiState): RpiState {
		return {
			...state,
			councilTotalRuns: state.councilTotalRuns ?? 0,
			councilRunsByPhase: state.councilRunsByPhase ?? {},
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

		const apiConfiguration = this.context.getApiConfiguration()
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
			await this.appendProgress(`Council ${councilPhase} run completed (${trigger}).`)
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
			await this.appendProgress(`Council ${councilPhase} run skipped (${trigger}).`)
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

	private async appendFinding(level: RpiEventLevel, message: string): Promise<void> {
		const timestamp = new Date().toISOString()
		const line = `- [${timestamp}] [${level.toUpperCase()}] ${message}\n`
		await fs.appendFile(this.findingsPath, line, "utf-8")
	}

	private async appendProgress(message: string): Promise<void> {
		const timestamp = new Date().toISOString()
		const line = `- [${timestamp}] ${message}\n`
		await fs.appendFile(this.progressPath, line, "utf-8")
	}

	private async syncArtifacts(): Promise<void> {
		if (!this.state) {
			return
		}
		await this.ensureArtifactHeaders()
		await this.writeStateFile()
		await this.writeTaskPlanFile()
	}

	private async ensureArtifactHeaders(): Promise<void> {
		await this.ensureFileWithHeader(
			this.findingsPath,
			"# RPI Findings\n\nAuto-managed durable findings log.\n\n## Entries\n",
		)
		await this.ensureFileWithHeader(
			this.progressPath,
			"# RPI Progress\n\nAuto-managed execution journal.\n\n## Timeline\n",
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

		const allPhases: RpiPhase[] = ["discovery", "planning", "implementation", "verification"]
		const completed = new Set(this.state.completedPhases)
		const required = new Set(this.state.requiredPhases)

		const phaseLines = allPhases
			.filter((phase) => required.has(phase))
			.map((phase) => {
				const mark = completed.has(phase) ? "x" : " "
				const label = phase.charAt(0).toUpperCase() + phase.slice(1)
				return `- [${mark}] ${label}`
			})
			.join("\n")

		const content = [
			"# RPI Task Plan",
			"",
			"Auto-managed by Roo RPI autopilot.",
			"",
			`- Task: ${this.state.taskSummary}`,
			`- Mode at start: ${this.state.modeAtStart}`,
			`- Strategy: ${this.state.strategy}`,
			`- Current phase: ${this.state.phase}`,
			`- Council runs: ${this.state.councilTotalRuns}`,
			`- Last tool: ${this.state.lastTool ?? "none"}`,
			`- Last update: ${this.state.lastUpdatedAt}`,
			"",
			"## Required Phases",
			phaseLines || "- [ ] Implementation",
			"",
			"## Flow Rules",
			"- Keep implementation and decisions synchronized with the current phase.",
			"- Persist durable knowledge in findings and progress files.",
			"- Completion is allowed only after verification gate succeeds.",
			"",
		].join("\n")

		await fs.writeFile(this.taskPlanPath, content, "utf-8")
	}
}
