import { describe, it, expect, beforeEach, vi } from "vitest"
import * as fs from "fs/promises"
import { AuditingWorkflowManager, WorkflowPhase, AuditReport } from "../AuditingWorkflowManager"
import { ClineProvider } from "../../webview/ClineProvider"

// Mock fs/promises module
vi.mock("fs/promises", () => ({
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue("{}"),
	mkdir: vi.fn().mockResolvedValue(undefined),
}))

describe("AuditingWorkflowManager", () => {
	let mockProvider: any
	let workflowManager: AuditingWorkflowManager
	const testWorkspacePath = "/test/workspace"

	beforeEach(() => {
		// Mock the ClineProvider
		mockProvider = {
			setMode: vi.fn().mockResolvedValue(undefined),
			createTask: vi.fn().mockResolvedValue({}),
			getMcpHub: vi.fn().mockReturnValue(undefined),
			log: vi.fn(),
		}

		workflowManager = new AuditingWorkflowManager(
			mockProvider as ClineProvider,
			testWorkspacePath,
			{ generatePlanFile: false }, // Disable file generation for most tests
		)
	})

	describe("initialization", () => {
		it("should initialize with default configuration", () => {
			// Create a manager without overriding defaults
			const defaultManager = new AuditingWorkflowManager(mockProvider as ClineProvider, testWorkspacePath)
			const config = (defaultManager as any).config
			expect(config.maxCorrectionIterations).toBe(2)
			expect(config.preserveContextBetweenPhases).toBe(false)
			expect(config.autoSwitchModes).toBe(true)
			expect(config.generatePlanFile).toBe(true)
		})

		it("should accept custom configuration", () => {
			const customManager = new AuditingWorkflowManager(mockProvider, testWorkspacePath, {
				maxCorrectionIterations: 3,
				preserveContextBetweenPhases: true,
				autoSwitchModes: false,
				generatePlanFile: false,
			})

			const config = (customManager as any).config
			expect(config.maxCorrectionIterations).toBe(3)
			expect(config.preserveContextBetweenPhases).toBe(true)
			expect(config.autoSwitchModes).toBe(false)
			expect(config.generatePlanFile).toBe(false)
		})
	})

	describe("workflow initialization", () => {
		it("should generate a phase plan", async () => {
			const taskDescription = "Implement user authentication with JWT"

			// Create manager with file generation disabled
			const testManager = new AuditingWorkflowManager(mockProvider as ClineProvider, testWorkspacePath, {
				generatePlanFile: false,
			})

			await testManager.initialize(taskDescription)

			expect(mockProvider.setMode).toHaveBeenCalledWith("architect")
			const phases = (testManager as any).phases
			expect(phases).toBeDefined()
			expect(phases.length).toBeGreaterThan(0)
			expect(phases[0].status).toBe("pending")
		})

		it("should save plan to file when configured", async () => {
			// Create manager with file generation enabled
			const fileManager = new AuditingWorkflowManager(mockProvider as ClineProvider, testWorkspacePath, {
				generatePlanFile: true,
			})

			await fileManager.initialize("Test task")

			expect(fs.writeFile).toHaveBeenCalled()
		})
	})

	describe("phase execution", () => {
		beforeEach(async () => {
			// Create manager with file generation disabled for tests
			workflowManager = new AuditingWorkflowManager(mockProvider as ClineProvider, testWorkspacePath, {
				generatePlanFile: false,
			})
			await workflowManager.initialize("Test task")
		})

		it("should start implementation for pending phase", async () => {
			const hasMore = await workflowManager.executeNextPhase()

			expect(hasMore).toBe(true)
			expect(mockProvider.setMode).toHaveBeenCalledWith("implementor")
			expect(mockProvider.createTask).toHaveBeenCalled()

			const currentPhase = workflowManager.getCurrentPhase()
			expect(currentPhase?.status).toBe("implementing")
		})

		it("should handle audit phase after implementation", async () => {
			// Set up phase with implementation result
			const phases = (workflowManager as any).phases as WorkflowPhase[]
			phases[0].status = "implementing"
			phases[0].implementationResult = {
				changes: "Added authentication module",
				reasoning: "Used JWT for stateless auth",
				acceptanceCriteriaStatus: {
					"Auth module created": true,
					"JWT integration": true,
				},
			}

			const hasMore = await workflowManager.executeNextPhase()

			expect(hasMore).toBe(true)
			expect(mockProvider.setMode).toHaveBeenCalledWith("auditor")
			expect(mockProvider.createTask).toHaveBeenCalled()

			const currentPhase = workflowManager.getCurrentPhase()
			expect(currentPhase?.status).toBe("auditing")
		})

		it("should handle corrections when audit requires revision", async () => {
			// Set up phase with audit report requiring corrections
			const phases = (workflowManager as any).phases as WorkflowPhase[]
			phases[0].status = "auditing"
			phases[0].auditReport = {
				verified: ["Basic structure is correct"],
				issues: ["Missing error handling"],
				requiredCorrections: ["Add try-catch blocks"],
				decision: "revise",
			}

			const hasMore = await workflowManager.executeNextPhase()

			expect(hasMore).toBe(true)

			const currentPhase = workflowManager.getCurrentPhase()
			expect(currentPhase?.status).toBe("corrections")
		})

		it("should complete phase when audit passes", async () => {
			// Set up phase with passing audit
			const phases = (workflowManager as any).phases as WorkflowPhase[]
			phases[0].status = "auditing"
			phases[0].auditReport = {
				verified: ["All criteria met"],
				issues: [],
				requiredCorrections: [],
				decision: "pass",
			}

			await workflowManager.executeNextPhase()

			// Should mark phase as completed
			expect(phases[0].status).toBe("completed")

			// Check if there are more phases to process
			const progress = workflowManager.getProgress()
			expect(progress.completedPhases).toBe(1)
			expect(progress.totalPhases).toBe(1)
		})
	})

	describe("progress tracking", () => {
		it("should calculate progress correctly", () => {
			// Create manager with file generation disabled for tests
			const progressManager: any = new AuditingWorkflowManager(mockProvider, testWorkspacePath, {
				generatePlanFile: false,
			})

			// Directly set phases and currentPhaseIndex for testing
			progressManager.phases = [
				{
					id: "phase-1",
					name: "Setup and Configuration",
					scope: ["Configuration files", "Initial structure"],
					objectives: ["Create necessary configuration", "Set up basic structure"],
					acceptanceCriteria: ["Configuration is valid", "Structure follows patterns"],
					status: "completed",
				},
				{
					id: "phase-2",
					name: "Phase 2",
					scope: ["Module B"],
					objectives: ["Objective B"],
					acceptanceCriteria: ["Criteria B"],
					status: "completed",
				},
				{
					id: "phase-3",
					name: "Phase 3",
					scope: ["Module C"],
					objectives: ["Objective C"],
					acceptanceCriteria: ["Criteria C"],
					status: "pending",
				},
			]

			// Set current phase index to point to Phase 2 (index 1)
			progressManager.currentPhaseIndex = 1

			const progress = progressManager.getProgress()

			expect(progress.totalPhases).toBe(3)
			expect(progress.completedPhases).toBe(2)
			expect(progress.percentComplete).toBe(67)
			expect(progress.currentPhase).toBe("Phase 2")
		})
	})

	describe("state persistence", () => {
		it("should export and import state correctly", async () => {
			// Create manager with file generation disabled
			const persistManager = new AuditingWorkflowManager(mockProvider as ClineProvider, testWorkspacePath, {
				generatePlanFile: false,
			})
			await persistManager.initialize("Test task")

			// Modify state
			const phases = (persistManager as any).phases as WorkflowPhase[]
			phases[0].status = "completed"
			phases[0].implementationResult = {
				changes: "Test changes",
				reasoning: "Test reasoning",
				acceptanceCriteriaStatus: { Test: true },
			}

			// Export state
			const exportedState = persistManager.exportState()

			// Create new manager and import state
			const newManager = new AuditingWorkflowManager(mockProvider, testWorkspacePath)
			newManager.importState(exportedState)

			// Verify state was restored
			const newPhases = (newManager as any).phases
			expect(newPhases[0].status).toBe("completed")
			expect(newPhases[0].implementationResult?.changes).toBe("Test changes")
		})
	})

	describe("audit report formatting", () => {
		it("should format audit report as markdown", () => {
			const report: AuditReport = {
				verified: ["Feature A works", "Feature B works"],
				issues: ["Missing validation", "No error handling"],
				requiredCorrections: ["Add input validation", "Add try-catch blocks"],
				additionalQuestions: ["Should we add logging?"],
				decision: "revise",
			}

			const formatted = (workflowManager as any).formatAuditReport(report)

			expect(formatted).toContain("✅ Verified")
			expect(formatted).toContain("Feature A works")
			expect(formatted).toContain("❌ Issues Found")
			expect(formatted).toContain("Missing validation")
			expect(formatted).toContain("📝 Required Corrections")
			expect(formatted).toContain("1. Add input validation")
			expect(formatted).toContain("❓ Additional Questions")
			expect(formatted).toContain("**Decision:** revise")
		})
	})
})
