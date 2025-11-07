// npx vitest run __tests__/provider-delegation.spec.ts

import { describe, it, expect, vi } from "vitest"
import { RooCodeEventName } from "@roo-code/types"
import { ClineProvider } from "../core/webview/ClineProvider"

describe("ClineProvider.delegateParentAndOpenChild()", () => {
	it("persists parent delegation metadata and emits TaskDelegated", async () => {
		const providerEmit = vi.fn()
		const parentTask = { taskId: "parent-1", emit: vi.fn() } as any

		const updateTaskHistory = vi.fn()
		const removeClineFromStack = vi.fn().mockResolvedValue(undefined)
		const createTask = vi.fn().mockResolvedValue({ taskId: "child-1" })
		const handleModeSwitch = vi.fn().mockResolvedValue(undefined)
		const getTaskWithId = vi.fn().mockResolvedValue({
			historyItem: {
				id: "parent-1",
				task: "Parent",
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
				childIds: [],
			},
		})

		const provider = {
			emit: providerEmit,
			getCurrentTask: vi.fn(() => parentTask),
			removeClineFromStack,
			createTask,
			getTaskWithId,
			updateTaskHistory,
			handleModeSwitch,
			log: vi.fn(),
		} as unknown as ClineProvider

		const params = {
			parentTaskId: "parent-1",
			message: "Do something",
			initialTodos: [],
			mode: "code",
		}

		const child = await (ClineProvider.prototype as any).delegateParentAndOpenChild.call(provider, params)

		expect(child.taskId).toBe("child-1")

		// Invariant: parent closed before child creation
		expect(removeClineFromStack).toHaveBeenCalledTimes(1)
		expect(createTask).toHaveBeenCalledWith("Do something", undefined, parentTask, { initialTodos: [] })

		// Metadata persistence
		expect(updateTaskHistory).toHaveBeenCalledTimes(1)
		const saved = updateTaskHistory.mock.calls[0][0]
		expect(saved).toEqual(
			expect.objectContaining({
				id: "parent-1",
				status: "delegated",
				delegatedToId: "child-1",
				awaitingChildId: "child-1",
				childIds: expect.arrayContaining(["child-1"]),
			}),
		)

		// Event emission (provider-level)
		expect(providerEmit).toHaveBeenCalledWith(RooCodeEventName.TaskDelegated, "parent-1", "child-1")

		// Mode switch
		expect(handleModeSwitch).toHaveBeenCalledWith("code")
	})
})
