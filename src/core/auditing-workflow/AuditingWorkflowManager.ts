import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { Task } from "../task/Task"
import { ClineProvider } from "../webview/ClineProvider"
import { TodoItem } from "@roo-code/types"

/**
 * Represents a single phase in the auditing workflow
 */
export interface WorkflowPhase {
	id: string
	name: string
	scope: string[]
	objectives: string[]
	acceptanceCriteria: string[]
	status: "pending" | "implementing" | "auditing" | "corrections" | "completed"
	implementationResult?: ImplementationResult
	auditReport?: AuditReport
	corrections?: CorrectionResult[]
}

/**
 * Result from an implementation phase
 */
export interface ImplementationResult {
	changes: string
	reasoning: string
	acceptanceCriteriaStatus: Record<string, boolean>
	notes?: string
}

/**
 * Audit report structure
 */
export interface AuditReport {
	verified: string[]
	issues: string[]
	requiredCorrections: string[]
	additionalQuestions?: string[]
	decision: "pass" | "revise" | "blocked"
}

/**
 * Result from applying corrections
 */
export interface CorrectionResult {
	correctionApplied: string
	validationStatus: Record<string, boolean>
	notes?: string
}

/**
 * Configuration for the auditing workflow
 */
export interface AuditingWorkflowConfig {
	maxCorrectionIterations: number
	preserveContextBetweenPhases: boolean
	autoSwitchModes: boolean
	generatePlanFile: boolean
}

/**
 * Manages the mutual auditing workflow between implementor and auditor models
 */
export class AuditingWorkflowManager {
	private phases: WorkflowPhase[] = []
	private currentPhaseIndex: number = 0
	private provider: ClineProvider
	private workspacePath: string
	private config: AuditingWorkflowConfig
	private planFilePath?: string
	private implementorTask?: Task
	private auditorTask?: Task

	constructor(provider: ClineProvider, workspacePath: string, config: Partial<AuditingWorkflowConfig> = {}) {
		this.provider = provider
		this.workspacePath = workspacePath
		this.config = {
			maxCorrectionIterations: config.maxCorrectionIterations ?? 2,
			preserveContextBetweenPhases: config.preserveContextBetweenPhases ?? false,
			autoSwitchModes: config.autoSwitchModes ?? true,
			generatePlanFile: config.generatePlanFile ?? true,
		}
	}

	/**
	 * Initialize the workflow with a task description
	 */
	async initialize(taskDescription: string): Promise<void> {
		// Generate the phase plan
		await this.generatePhasePlan(taskDescription)

		// Save plan to file if configured
		if (this.config.generatePlanFile) {
			await this.savePlanToFile()
		}
	}

	/**
	 * Generate a phase plan for the given task
	 */
	private async generatePhasePlan(taskDescription: string): Promise<void> {
		// Switch to architect mode to create the plan
		await this.provider.setMode("architect")

		// Create a planning task
		const planningMessage = `Create a detailed phase plan for implementing the following task using the mutual auditing workflow:

${taskDescription}

Break down the implementation into small, focused phases. Each phase should:
- Have a clear scope (which files/modules to touch)
- Define specific objectives
- Include measurable acceptance criteria
- Be completable in a single focused session

Format the plan as a structured list of phases.`

		// In a real implementation, this would use the Task system to get the plan
		// For now, we'll create a sample plan structure
		this.phases = [
			{
				id: "phase-1",
				name: "Setup and Configuration",
				scope: ["Configuration files", "Initial structure"],
				objectives: ["Create necessary configuration", "Set up basic structure"],
				acceptanceCriteria: ["Configuration is valid", "Structure follows patterns"],
				status: "pending",
			},
			// Additional phases would be dynamically generated
		]
	}

	/**
	 * Save the current plan to a markdown file
	 */
	private async savePlanToFile(): Promise<void> {
		const planContent = this.generatePlanMarkdown()
		this.planFilePath = path.join(this.workspacePath, "auditing-workflow-plan.md")
		await fs.writeFile(this.planFilePath, planContent, "utf-8")
	}

	/**
	 * Generate markdown representation of the plan
	 */
	private generatePlanMarkdown(): string {
		let content = "# Auditing Workflow Plan\n\n"

		for (const phase of this.phases) {
			content += `## ${phase.name}\n\n`
			content += `**Status:** ${phase.status}\n\n`
			content += `### Scope\n`
			phase.scope.forEach((item) => {
				content += `- ${item}\n`
			})
			content += `\n### Objectives\n`
			phase.objectives.forEach((item) => {
				content += `- ${item}\n`
			})
			content += `\n### Acceptance Criteria\n`
			phase.acceptanceCriteria.forEach((item) => {
				content += `- [ ] ${item}\n`
			})

			if (phase.implementationResult) {
				content += `\n### Implementation Result\n`
				content += `**Changes:** ${phase.implementationResult.changes}\n`
				content += `**Reasoning:** ${phase.implementationResult.reasoning}\n`
			}

			if (phase.auditReport) {
				content += `\n### Audit Report\n`
				content += this.formatAuditReport(phase.auditReport)
			}

			content += "\n---\n\n"
		}

		return content
	}

	/**
	 * Format an audit report as markdown
	 */
	private formatAuditReport(report: AuditReport): string {
		let content = ""

		if (report.verified.length > 0) {
			content += "#### ✅ Verified\n"
			report.verified.forEach((item) => {
				content += `- ${item}\n`
			})
			content += "\n"
		}

		if (report.issues.length > 0) {
			content += "#### ❌ Issues Found\n"
			report.issues.forEach((item) => {
				content += `- ${item}\n`
			})
			content += "\n"
		}

		if (report.requiredCorrections.length > 0) {
			content += "#### 📝 Required Corrections\n"
			report.requiredCorrections.forEach((item, index) => {
				content += `${index + 1}. ${item}\n`
			})
			content += "\n"
		}

		if (report.additionalQuestions && report.additionalQuestions.length > 0) {
			content += "#### ❓ Additional Questions\n"
			report.additionalQuestions.forEach((item) => {
				content += `- ${item}\n`
			})
			content += "\n"
		}

		content += `**Decision:** ${report.decision}\n`

		return content
	}

	/**
	 * Execute the next phase in the workflow
	 */
	async executeNextPhase(): Promise<boolean> {
		if (this.currentPhaseIndex >= this.phases.length) {
			return false // All phases completed
		}

		const currentPhase = this.phases[this.currentPhaseIndex]

		switch (currentPhase.status) {
			case "pending":
				await this.startImplementation(currentPhase)
				break
			case "implementing":
				await this.startAudit(currentPhase)
				break
			case "auditing":
				await this.processAuditResult(currentPhase)
				break
			case "corrections":
				await this.applyCorrections(currentPhase)
				break
			case "completed":
				this.currentPhaseIndex++
				if (this.currentPhaseIndex < this.phases.length) {
					await this.resetContext()
				}
				break
		}

		// Update plan file
		if (this.config.generatePlanFile) {
			await this.savePlanToFile()
		}

		return this.currentPhaseIndex < this.phases.length
	}

	/**
	 * Start implementation for a phase
	 */
	private async startImplementation(phase: WorkflowPhase): Promise<void> {
		if (this.config.autoSwitchModes) {
			await this.provider.setMode("implementor")
		}

		const implementationMessage = this.buildImplementationMessage(phase)

		// Create implementation task with phase-specific todos
		const todos: TodoItem[] = phase.acceptanceCriteria.map((criteria, index) => ({
			id: `phase-${phase.id}-criteria-${index}`,
			content: criteria,
			status: "pending" as const,
		}))

		this.implementorTask = await this.provider.createTask(implementationMessage, undefined, undefined, {
			initialTodos: todos,
		})

		phase.status = "implementing"
	}

	/**
	 * Build the implementation message for a phase
	 */
	private buildImplementationMessage(phase: WorkflowPhase): string {
		return `## Implementation Phase: ${phase.name}

### Scope
${phase.scope.map((s) => `- ${s}`).join("\n")}

### Objectives
${phase.objectives.map((o) => `- ${o}`).join("\n")}

### Acceptance Criteria
${phase.acceptanceCriteria.map((ac) => `- [ ] ${ac}`).join("\n")}

Please implement this phase following the implementor mode guidelines:
1. Focus only on the scope defined above
2. Provide clear reasoning for your implementation decisions
3. Track which acceptance criteria are satisfied
4. Document any assumptions or blockers

When complete, provide a summary of:
- What was implemented
- Key design decisions and rationale
- Status of each acceptance criterion
- Any issues or dependencies discovered`
	}

	/**
	 * Start audit for a completed implementation
	 */
	private async startAudit(phase: WorkflowPhase): Promise<void> {
		if (this.config.autoSwitchModes) {
			await this.provider.setMode("auditor")
		}

		const auditMessage = this.buildAuditMessage(phase)

		this.auditorTask = await this.provider.createTask(auditMessage)

		phase.status = "auditing"
	}

	/**
	 * Build the audit message for a phase
	 */
	private buildAuditMessage(phase: WorkflowPhase): string {
		return `## Audit Phase: ${phase.name}

### Phase Plan
**Scope:** ${phase.scope.join(", ")}
**Objectives:** ${phase.objectives.join(", ")}

### Acceptance Criteria
${phase.acceptanceCriteria.map((ac) => `- ${ac}`).join("\n")}

### Implementation Result
${
	phase.implementationResult
		? `
**Changes:** ${phase.implementationResult.changes}
**Reasoning:** ${phase.implementationResult.reasoning}
**Criteria Status:** ${JSON.stringify(phase.implementationResult.acceptanceCriteriaStatus, null, 2)}
`
		: "No implementation result available"
}

Please audit this implementation following the auditor mode guidelines:
1. Review the code changes for correctness
2. Validate that acceptance criteria are actually met
3. Identify any issues, bugs, or missing requirements
4. Provide a structured audit report with your decision (pass/revise/blocked)

Format your response as a structured audit report.`
	}

	/**
	 * Process the audit result and determine next steps
	 */
	private async processAuditResult(phase: WorkflowPhase): Promise<void> {
		if (!phase.auditReport) {
			// In real implementation, this would parse the auditor's response
			phase.auditReport = {
				verified: [],
				issues: [],
				requiredCorrections: [],
				decision: "pass",
			}
		}

		switch (phase.auditReport.decision) {
			case "pass":
				phase.status = "completed"
				break
			case "revise":
				phase.status = "corrections"
				break
			case "blocked":
				// Handle blocked state - might need user intervention
				await this.handleBlockedPhase(phase)
				break
		}
	}

	/**
	 * Apply corrections based on audit feedback
	 */
	private async applyCorrections(phase: WorkflowPhase): Promise<void> {
		if (!phase.auditReport || phase.auditReport.requiredCorrections.length === 0) {
			phase.status = "completed"
			return
		}

		if (this.config.autoSwitchModes) {
			await this.provider.setMode("implementor")
		}

		const correctionMessage = this.buildCorrectionMessage(phase)

		// Create correction task
		const correctionTask = await this.provider.createTask(correctionMessage)

		// After corrections, go back to audit
		phase.status = "auditing"
	}

	/**
	 * Build the correction message for a phase
	 */
	private buildCorrectionMessage(phase: WorkflowPhase): string {
		return `## Apply Corrections: ${phase.name}

### Audit Feedback
${phase.auditReport ? this.formatAuditReport(phase.auditReport) : "No audit report available"}

### Required Corrections
${phase.auditReport?.requiredCorrections.map((c, i) => `${i + 1}. ${c}`).join("\n") || "None"}

Please apply the required corrections:
1. Address each correction item systematically
2. Validate that the corrections resolve the identified issues
3. Re-check the affected acceptance criteria
4. Document what was changed and why

Provide a summary of:
- Which corrections were applied
- How each correction addresses the audit feedback
- Updated status of acceptance criteria`
	}

	/**
	 * Handle a blocked phase
	 */
	private async handleBlockedPhase(phase: WorkflowPhase): Promise<void> {
		const message = `Phase "${phase.name}" is blocked.

Audit Report:
${phase.auditReport ? this.formatAuditReport(phase.auditReport) : "No audit report"}

This phase requires external clarification or dependencies to be resolved before continuing.
Please review the audit report and provide guidance on how to proceed.`

		await vscode.window.showWarningMessage(message, "Continue", "Skip Phase")
		// Handle user response appropriately
	}

	/**
	 * Reset context between phases
	 */
	private async resetContext(): Promise<void> {
		if (!this.config.preserveContextBetweenPhases) {
			// Clear task instances to release memory
			this.implementorTask = undefined
			this.auditorTask = undefined

			// Could implement more sophisticated context management here
		}
	}

	/**
	 * Get the current phase
	 */
	getCurrentPhase(): WorkflowPhase | undefined {
		return this.phases[this.currentPhaseIndex]
	}

	/**
	 * Get workflow progress
	 */
	getProgress(): {
		totalPhases: number
		completedPhases: number
		currentPhase: string
		percentComplete: number
	} {
		const completedPhases = this.phases.filter((p) => p.status === "completed").length
		const currentPhase = this.getCurrentPhase()

		return {
			totalPhases: this.phases.length,
			completedPhases,
			currentPhase: currentPhase?.name || "None",
			percentComplete: this.phases.length > 0 ? Math.round((completedPhases / this.phases.length) * 100) : 0,
		}
	}

	/**
	 * Export the workflow state for persistence
	 */
	exportState(): string {
		return JSON.stringify(
			{
				phases: this.phases,
				currentPhaseIndex: this.currentPhaseIndex,
				config: this.config,
				planFilePath: this.planFilePath,
			},
			null,
			2,
		)
	}

	/**
	 * Import workflow state from persistence
	 */
	importState(state: string): void {
		const parsed = JSON.parse(state)
		this.phases = parsed.phases || []
		this.currentPhaseIndex = parsed.currentPhaseIndex || 0
		this.config = parsed.config || this.config
		this.planFilePath = parsed.planFilePath
	}
}
