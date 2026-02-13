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
				isCouncilEngineEnabled: () => councilEnabled,
			},
			mockEngine as any,
		)

		await autopilot.ensureInitialized()
		return { autopilot, mockEngine }
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
		const { autopilot, mockEngine } = await createAutopilot({
			mode: "code",
			taskText: "Simple clarification task.",
		})

		const blocker = await autopilot.getCompletionBlocker()

		expect(blocker).toContain("Implementation evidence")
		expect(mockEngine.runVerificationReview).not.toHaveBeenCalled()
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
})
