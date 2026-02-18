// npx vitest run tests/core/tools/SelectActiveIntentTool.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import { SelectActiveIntentTool } from "../../../src/core/tools/SelectActiveIntentTool"
import { Task } from "../../../src/core/task/Task"
import { IntentManager } from "../../../src/hooks/IntentManager"
import type { ActiveIntent } from "../../../src/hooks/types"

vi.mock("../../../src/hooks/IntentManager")

describe("SelectActiveIntentTool", () => {
	let tool: SelectActiveIntentTool
	let mockTask: Task
	let mockIntentManager: vi.Mocked<IntentManager>
	let mockCallbacks: any

	beforeEach(() => {
		mockIntentManager = {
			setActiveIntent: vi.fn().mockResolvedValue(undefined),
			getActiveIntent: vi.fn().mockResolvedValue(null),
			getIntent: vi.fn().mockResolvedValue(null),
		} as unknown as vi.Mocked<IntentManager>

		tool = new SelectActiveIntentTool(mockIntentManager)

		mockTask = {
			taskId: "task-123",
			say: vi.fn().mockResolvedValue(""),
		} as unknown as Task

		mockCallbacks = {
			pushToolResult: vi.fn(),
			handleError: vi.fn(),
		}
	})

	describe("execute", () => {
		it("should set active intent when intent exists", async () => {
			const mockIntent: ActiveIntent = {
				id: "INT-001",
				name: "Feature A",
				description: "Implement feature A",
				status: "PENDING",
				ownedScope: ["src/features/a/**"],
				constraints: [],
				acceptanceCriteria: [],
			}

			mockIntentManager.getIntent.mockResolvedValue(mockIntent)

			await tool.execute({ intent_id: "INT-001" }, mockTask, mockCallbacks)

			expect(mockIntentManager.setActiveIntent).toHaveBeenCalledWith("task-123", "INT-001")
			expect(mockCallbacks.pushToolResult).toHaveBeenCalled()
		})

		it("should return error when intent does not exist", async () => {
			mockIntentManager.getIntent.mockResolvedValue(null)

			await tool.execute({ intent_id: "INT-999" }, mockTask, mockCallbacks)

			expect(mockIntentManager.setActiveIntent).not.toHaveBeenCalled()
			expect(mockCallbacks.pushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("Intent INT-999 not found"),
			)
		})

		it("should return error when intent_id is missing", async () => {
			await tool.execute({ intent_id: "" }, mockTask, mockCallbacks)

			expect(mockIntentManager.setActiveIntent).not.toHaveBeenCalled()
			expect(mockCallbacks.pushToolResult).toHaveBeenCalled()
		})
	})
})
