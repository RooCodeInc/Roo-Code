// npx vitest run __tests__/provider-delegation.spec.ts

import { describe, it, expect, vi } from "vitest"
import { RooCodeEventName } from "@roo-code/types"
import { ClineProvider } from "../core/webview/ClineProvider"

describe("ClineProvider.delegateParentAndOpenChild()", () => {
	it("persists parent delegation metadata and emits TaskDelegated", async () => {
		const providerEmit = vi.fn()
		const parentTask = { taskId: "parent-1", emit: vi.fn() } as any

		const childStart = vi.fn()
		const updateTaskHistory = vi.fn()
		const removeClineFromStack = vi.fn().mockResolvedValue(undefined)
		const createTask = vi.fn().mockResolvedValue({ taskId: "child-1", start: childStart })
		const handleModeSwitch = vi.fn().mockResolvedValue(undefined)
		const getTaskWithId = vi.fn().mockImplementation(async (id: string) => {
			if (id === "parent-1") {
				return {
					historyItem: {
						id: "parent-1",
						task: "Parent",
						tokensIn: 0,
						tokensOut: 0,
						totalCost: 0,
						childIds: [],
					},
				}
			}
			// child-1
			return {
				historyItem: {
					id: "child-1",
					task: "Do something",
					tokensIn: 0,
					tokensOut: 0,
					totalCost: 0,
				},
			}
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
		// Child task is created with startTask: false and initialStatus: "active"
		expect(createTask).toHaveBeenCalledWith("Do something", undefined, parentTask, {
			initialTodos: [],
			initialStatus: "active",
			startTask: false,
		})

		// Metadata persistence - parent gets "delegated" status (child status is set at creation via initialStatus)
		expect(updateTaskHistory).toHaveBeenCalledTimes(1)

		// Parent set to "delegated"
		const parentSaved = updateTaskHistory.mock.calls[0][0]
		expect(parentSaved).toEqual(
			expect.objectContaining({
				id: "parent-1",
				status: "delegated",
				delegatedToId: "child-1",
				awaitingChildId: "child-1",
				childIds: expect.arrayContaining(["child-1"]),
			}),
		)

		// child.start() must be called AFTER parent metadata is persisted
		expect(childStart).toHaveBeenCalledTimes(1)

		// Event emission (provider-level)
		expect(providerEmit).toHaveBeenCalledWith(RooCodeEventName.TaskDelegated, "parent-1", "child-1")

		// Mode switch
		expect(handleModeSwitch).toHaveBeenCalledWith("code")
	})

	it("calls child.start() only after parent metadata is persisted (no race condition)", async () => {
		const callOrder: string[] = []

		const parentTask = { taskId: "parent-1", emit: vi.fn() } as any
		const childStart = vi.fn(() => callOrder.push("child.start"))

		const updateTaskHistory = vi.fn(async () => {
			callOrder.push("updateTaskHistory")
		})
		const removeClineFromStack = vi.fn().mockResolvedValue(undefined)
		const createTask = vi.fn(async () => {
			callOrder.push("createTask")
			return { taskId: "child-1", start: childStart }
		})
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
			emit: vi.fn(),
			getCurrentTask: vi.fn(() => parentTask),
			removeClineFromStack,
			createTask,
			getTaskWithId,
			updateTaskHistory,
			handleModeSwitch,
			log: vi.fn(),
		} as unknown as ClineProvider

		await (ClineProvider.prototype as any).delegateParentAndOpenChild.call(provider, {
			parentTaskId: "parent-1",
			message: "Do something",
			initialTodos: [],
			mode: "code",
		})

		// Verify ordering: createTask → updateTaskHistory → child.start
		expect(callOrder).toEqual(["createTask", "updateTaskHistory", "child.start"])
	})
})
