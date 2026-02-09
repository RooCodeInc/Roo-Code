import fs from "fs/promises"
import * as path from "path"

type RpiStrategy = "quick" | "standard" | "full"
type RpiPhase = "discovery" | "planning" | "implementation" | "verification" | "done"

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

export class RpiAutopilot {
	private state?: RpiState
	private initialized = false
	private ioQueue: Promise<void> = Promise.resolve()

	constructor(private readonly context: RpiAutopilotContext) {}

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
				this.state = fromDisk
			} else {
				this.state = this.createInitialState(mode, taskText)
			}

			await this.syncArtifacts()
			this.initialized = true
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
				this.completePhase(this.state.phase)
				this.state.phase = "verification"
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
			lastUpdatedAt: now,
			createdAt: now,
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
