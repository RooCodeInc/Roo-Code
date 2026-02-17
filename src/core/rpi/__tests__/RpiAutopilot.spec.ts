import fs from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RpiAutopilot } from "../RpiAutopilot"
import type { ProviderSettings } from "@roo-code/types"

const apiConfiguration: ProviderSettings = { apiProvider: "openrouter" }

const createCouncilResult = (summary: string) => ({
	summary,
	findings: ["finding"],
	risks: [],
	rawResponse: `{"summary":"${summary}","findings":["finding"],"risks":[]}`,
})

describe("RpiAutopilot council engine integration", () => {
	const createdDirs: string[] = []

	afterEach(async () => {
		await Promise.all(
			createdDirs.splice(0).map(async (dir) => {
				await fs.rm(dir, { recursive: true, force: true })
			}),
		)
	})

	const createAutopilot = async (options?: {
		mode?: string
		taskText?: string
		councilEnabled?: boolean
		completedChildTaskId?: string
		tokenUsage?: { totalCost?: number; totalTokensIn?: number; totalTokensOut?: number }
		qualityGatesYaml?: string
		engineOverrides?: Partial<
			Record<"analyzeContext" | "decomposeTask" | "buildDecision" | "runVerificationReview", any>
		>
	}) => {
		const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "roo-rpi-autopilot-"))
		createdDirs.push(cwd)

		const mode = options?.mode ?? "architect"
		const taskText =
			options?.taskText ??
			"Build architecture migration workflow with integration and security requirements across multiple modules."
		const councilEnabled = options?.councilEnabled ?? true
		if (options?.qualityGatesYaml) {
			const policyDir = path.join(cwd, "policy")
			await fs.mkdir(policyDir, { recursive: true })
			await fs.writeFile(path.join(policyDir, "quality-gates.yaml"), options.qualityGatesYaml, "utf-8")
		}

		const mockEngine = {
			analyzeContext: vi.fn().mockResolvedValue(createCouncilResult("discovery summary")),
			decomposeTask: vi.fn().mockResolvedValue(createCouncilResult("decomposition summary")),
			buildDecision: vi.fn().mockResolvedValue(createCouncilResult("decision summary")),
			runVerificationReview: vi.fn().mockResolvedValue(createCouncilResult("verification summary")),
			...options?.engineOverrides,
		}

		const autopilot = new RpiAutopilot(
			{
				taskId: "task-123",
				cwd,
				getMode: async () => mode,
				getTaskText: () => taskText,
				getApiConfiguration: async () => apiConfiguration,
				getTokenUsage: () => options?.tokenUsage,
				isCouncilEngineEnabled: () => councilEnabled,
				getCompletedChildTaskId: () => options?.completedChildTaskId,
			},
			mockEngine as any,
		)

		await autopilot.ensureInitialized()
		return { autopilot, mockEngine, cwd }
	}

	it("runs discovery and planning council actions once with phase/complexity triggers", async () => {
		const { autopilot, mockEngine } = await createAutopilot()

		await autopilot.onToolStart("read_file")
		await autopilot.onToolStart("search_files")
		await autopilot.onToolStart("update_todo_list")
		await autopilot.onToolStart("update_todo_list")

		expect(mockEngine.analyzeContext).toHaveBeenCalledTimes(1)
		expect(mockEngine.decomposeTask).toHaveBeenCalledTimes(1)
		expect(mockEngine.buildDecision).toHaveBeenCalledTimes(1)
	})

	it("runs verification council on completion when implementation evidence exists", async () => {
		const { autopilot, mockEngine } = await createAutopilot({
			mode: "code",
			taskText: "Implement bug fix with focused changes.",
		})

		await autopilot.onToolStart("write_to_file", { path: "src/file.ts" })
		await autopilot.onToolFinish("write_to_file", {
			toolName: "write_to_file",
			timestamp: new Date().toISOString(),
			success: true,
			summary: "Wrote src/file.ts",
			filesAffected: ["src/file.ts"],
		})
		const blocker = await autopilot.getCompletionBlocker()

		expect(blocker).toBeUndefined()
		expect(mockEngine.runVerificationReview).toHaveBeenCalledTimes(1)
	})

	it("does not run verification council when blocked due to missing implementation evidence", async () => {
		const { autopilot, mockEngine, cwd } = await createAutopilot({
			mode: "code",
			taskText: "Simple clarification task.",
		})

		const blocker = await autopilot.getCompletionBlocker()

		expect(blocker).toContain("Implementation evidence")
		expect(mockEngine.runVerificationReview).not.toHaveBeenCalled()

		const replayPath = path.join(cwd, ".roo", "rpi", "task-123", "replay_record.json")
		const replayContent = await fs.readFile(replayPath, "utf-8")
		expect(JSON.parse(replayContent).reason).toBe("verification_failed")
	})

	it("skips all council execution when feature is disabled", async () => {
		const { autopilot, mockEngine } = await createAutopilot({ councilEnabled: false })

		await autopilot.onToolStart("read_file")
		await autopilot.onToolStart("update_todo_list")
		await autopilot.getCompletionBlocker()

		expect(mockEngine.analyzeContext).not.toHaveBeenCalled()
		expect(mockEngine.decomposeTask).not.toHaveBeenCalled()
		expect(mockEngine.buildDecision).not.toHaveBeenCalled()
		expect(mockEngine.runVerificationReview).not.toHaveBeenCalled()
	})

	it("accepts completion when implementation evidence exists only in a completed child task", async () => {
		const completedChildTaskId = "child-1"
		const { autopilot, cwd } = await createAutopilot({
			mode: "code",
			taskText: "Implement bug fix with focused changes.",
			councilEnabled: false,
			completedChildTaskId,
		})

		const childDir = path.join(cwd, ".roo", "rpi", completedChildTaskId)
		await fs.mkdir(childDir, { recursive: true })
		await fs.writeFile(
			path.join(childDir, "state.json"),
			JSON.stringify(
				{
					version: 1,
					taskId: completedChildTaskId,
					taskSummary: "child task summary",
					modeAtStart: "code",
					strategy: "quick",
					phase: "done",
					requiredPhases: ["implementation", "verification"],
					completedPhases: ["implementation", "verification", "done"],
					toolRuns: 1,
					writeOps: 1,
					commandOps: 0,
					notesCount: 0,
					councilTotalRuns: 0,
					councilRunsByPhase: {},
					lastUpdatedAt: new Date().toISOString(),
					createdAt: new Date().toISOString(),
					observations: [
						{
							toolName: "write_to_file",
							timestamp: new Date().toISOString(),
							success: true,
							summary: "Wrote src/file.ts",
							filesAffected: ["src/file.ts"],
						},
					],
					lastObservation: {
						toolName: "write_to_file",
						timestamp: new Date().toISOString(),
						success: true,
						summary: "Wrote src/file.ts",
						filesAffected: ["src/file.ts"],
					},
					observationCount: 1,
					stepAttempts: {},
				},
				null,
				2,
			),
			"utf-8",
		)

		const blocker = await autopilot.getCompletionBlocker()
		expect(blocker).toBeUndefined()
	})

	it("blocks completion when cost guardrail fallback threshold is exceeded", async () => {
		const { autopilot, cwd } = await createAutopilot({
			mode: "code",
			taskText: "Implement fix quickly.",
			councilEnabled: false,
			tokenUsage: { totalCost: 10 },
		})

		const blocker = await autopilot.getCompletionBlocker()
		expect(blocker).toContain("cost guardrail blocked completion")

		const replayPath = path.join(cwd, ".roo", "rpi", "task-123", "replay_record.json")
		const replayContent = await fs.readFile(replayPath, "utf-8")
		expect(JSON.parse(replayContent).reason).toBe("cost_guardrail_blocked")
	})

	it("blocks completion on canary failure when runtime failure rate exceeds policy", async () => {
		const { autopilot, cwd } = await createAutopilot({
			mode: "code",
			taskText: "Implement fix and validate.",
			councilEnabled: false,
			qualityGatesYaml: [
				"verification:",
				"  requireImplementationEvidence: true",
				"  enforceLastCommandSuccessOn: [standard, strict]",
				"  enforceNoUnresolvedWriteErrorsOn: [standard, strict]",
				"  enforceTaskKeywordMatchingOn: [strict]",
				"  commandKeywords: [test, spec]",
				"finalization:",
				"  requiredPreCompletionArtifacts: [state.json, task_plan.md, findings.md, progress.md, execution_trace.jsonl]",
				"  requiredPostCompletionArtifacts: [final_summary.md]",
				"replay:",
				"  includeRecentObservations: 10",
				"  includeRecentTraceEvents: 25",
				"performance:",
				"  adaptiveConcurrency:",
				"    enabled: true",
				"    evaluationWindow: 8",
				"    failureRateThreshold: 0.3",
				"    p95LatencyMsThreshold: 15000",
				"    fallbackFailureRateThreshold: 0.6",
				"    fallbackP95LatencyMsThreshold: 30000",
				"  costGuardrails:",
				"    enabled: false",
				"    maxTaskCostUsd: 100",
				"    warnAtRatio: 0.8",
				"    throttleAtRatio: 1.0",
				"    fallbackAtRatio: 1.2",
				"rollout:",
				"  canary:",
				"    enabled: true",
				"    sampleSize: 1",
				"    maxFailureRate: 0.1",
				"    maxP95LatencyMs: 30000",
				"    minCodeReviewScore: 1",
				"memory:",
				"  freshnessTtlHours: 336",
				"  maxStaleResults: 1",
			].join("\n"),
		})

		await autopilot.onToolStart("write_to_file", { path: "src/file.ts" })
		await autopilot.onToolFinish("write_to_file", {
			toolName: "write_to_file",
			timestamp: new Date().toISOString(),
			success: true,
			summary: "Wrote src/file.ts",
			filesAffected: ["src/file.ts"],
		})
		await autopilot.onToolStart("execute_command", { command: "pnpm test" })
		await autopilot.onToolFinish("execute_command", {
			toolName: "execute_command",
			timestamp: new Date().toISOString(),
			success: false,
			summary: "Tests failed",
			error: "non-zero exit",
		})

		const blocker = await autopilot.getCompletionBlocker()
		expect(blocker).toContain("Canary failed: failure rate")

		const replayPath = path.join(cwd, ".roo", "rpi", "task-123", "replay_record.json")
		const replayContent = await fs.readFile(replayPath, "utf-8")
		expect(JSON.parse(replayContent).reason).toBe("canary_gate_failed")
	})
})
