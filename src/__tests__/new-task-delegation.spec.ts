// npx vitest run __tests__/new-task-delegation.spec.ts

import { describe, it, expect, vi } from "vitest"
import { RooCodeEventName } from "@roo-code/types"
import { Task } from "../core/task/Task"

describe("Task.startSubtask() metadata-driven delegation", () => {
	it("Routes to provider.delegateParentAndOpenChild without pausing parent", async () => {
		const provider = {
			getState: vi.fn().mockResolvedValue({
				experiments: {},
			}),
			delegateParentAndOpenChild: vi.fn().mockResolvedValue({ taskId: "child-1" }),
			createTask: vi.fn(),
			handleModeSwitch: vi.fn(),
		} as any

		// Create a minimal Task-like instance with only fields used by startSubtask
		const parent = Object.create(Task.prototype) as Task
		;(parent as any).taskId = "parent-1"
		;(parent as any).providerRef = { deref: () => provider }
		;(parent as any).emit = vi.fn()

		const child = await (Task.prototype as any).startSubtask.call(parent, "Do something", [], "code")

		expect(provider.delegateParentAndOpenChild).toHaveBeenCalledWith({
			parentTaskId: "parent-1",
			message: "Do something",
			initialTodos: [],
			mode: "code",
		})
		expect(child.taskId).toBe("child-1")

		// Parent should not be paused and no paused/unpaused events should be emitted
		expect((parent as any).isPaused).not.toBe(true)
		expect((parent as any).childTaskId).toBeUndefined()
		const emittedEvents = (parent.emit as any).mock.calls.map((c: any[]) => c[0])
		expect(emittedEvents).not.toContain(RooCodeEventName.TaskPaused)
		expect(emittedEvents).not.toContain(RooCodeEventName.TaskUnpaused)

		// Legacy path not used
		expect(provider.createTask).not.toHaveBeenCalled()
	})
})

describe("Deterministic todo anchor selection for subtaskId linking", () => {
	// Helper to simulate the anchor selection algorithm from delegateParentAndOpenChild
	function selectDeterministicAnchor(
		todos: Array<{ id: string; content: string; status: string; subtaskId?: string }>,
	): { id: string; content: string; status: string; subtaskId?: string } | undefined {
		const inProgress = todos.filter((t) => t?.status === "in_progress")
		const pending = todos.filter((t) => t?.status === "pending")
		const completed = todos.filter((t) => t?.status === "completed")

		if (inProgress.length > 0) {
			return inProgress[0]
		} else if (pending.length > 0) {
			return pending[0]
		} else if (completed.length > 0) {
			return completed[completed.length - 1] // Last completed
		}
		return undefined
	}

	it("selects first in_progress todo when available", () => {
		const todos = [
			{ id: "1", content: "Task A", status: "completed" },
			{ id: "2", content: "Task B", status: "in_progress" },
			{ id: "3", content: "Task C", status: "pending" },
		]

		const chosen = selectDeterministicAnchor(todos)
		expect(chosen?.id).toBe("2")
		expect(chosen?.status).toBe("in_progress")
	})

	it("selects first pending todo when no in_progress", () => {
		const todos = [
			{ id: "1", content: "Task A", status: "completed" },
			{ id: "2", content: "Task B", status: "pending" },
			{ id: "3", content: "Task C", status: "pending" },
		]

		const chosen = selectDeterministicAnchor(todos)
		expect(chosen?.id).toBe("2")
		expect(chosen?.status).toBe("pending")
	})

	it("selects LAST completed todo when all todos are completed", () => {
		const todos = [
			{ id: "1", content: "Task A", status: "completed" },
			{ id: "2", content: "Task B", status: "completed" },
			{ id: "3", content: "Task C", status: "completed" },
		]

		const chosen = selectDeterministicAnchor(todos)
		// Should pick the LAST completed (closest to delegation moment)
		expect(chosen?.id).toBe("3")
		expect(chosen?.content).toBe("Task C")
	})

	it("returns undefined when no todos exist (triggers synthetic anchor creation)", () => {
		const todos: Array<{ id: string; content: string; status: string }> = []
		const chosen = selectDeterministicAnchor(todos)
		expect(chosen).toBeUndefined()
	})

	it("handles mixed statuses deterministically", () => {
		const todos = [
			{ id: "1", content: "Done early", status: "completed" },
			{ id: "2", content: "In progress", status: "in_progress" },
			{ id: "3", content: "Done late", status: "completed" },
			{ id: "4", content: "Still pending", status: "pending" },
		]

		// Should prefer in_progress over everything
		const chosen = selectDeterministicAnchor(todos)
		expect(chosen?.id).toBe("2")
	})
})
