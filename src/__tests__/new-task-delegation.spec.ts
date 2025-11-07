// npx vitest run __tests__/new-task-delegation.spec.ts

import { describe, it, expect, vi } from "vitest"
import { RooCodeEventName } from "@roo-code/types"
import { Task } from "../core/task/Task"

describe("Task.startSubtask() experiment-gated delegation", () => {
	it("Flag ON: routes to provider.delegateParentAndOpenChild without pausing parent", async () => {
		const provider = {
			getState: vi.fn().mockResolvedValue({
				experiments: { metadataDrivenSubtasks: true },
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

		// Spy on waitForSubtask to ensure it's NEVER called in flag-ON path
		const waitForSubtaskSpy = vi.spyOn(Task.prototype, "waitForSubtask")

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

		// CRITICAL: waitForSubtask should NEVER be called in flag-ON path
		expect(waitForSubtaskSpy).not.toHaveBeenCalled()

		// Legacy path not used
		expect(provider.createTask).not.toHaveBeenCalled()

		waitForSubtaskSpy.mockRestore()
	})

	it("Flag OFF: preserves legacy spawn/pause flow with TaskPaused/TaskUnpaused events", async () => {
		const provider = {
			getState: vi.fn().mockResolvedValue({
				experiments: { metadataDrivenSubtasks: false },
				mode: "ask",
			}),
			delegateParentAndOpenChild: vi.fn(),
			createTask: vi.fn().mockResolvedValue({ taskId: "child-2" }),
			handleModeSwitch: vi.fn().mockResolvedValue(undefined),
		} as any

		const parent = Object.create(Task.prototype) as Task
		;(parent as any).taskId = "parent-2"
		;(parent as any).providerRef = { deref: () => provider }
		;(parent as any).emit = vi.fn()

		const child = await (Task.prototype as any).startSubtask.call(parent, "Legacy path", [], "code")

		expect(provider.createTask).toHaveBeenCalledWith("Legacy path", undefined, parent, { initialTodos: [] })
		expect(child.taskId).toBe("child-2")
		expect((parent as any).isPaused).toBe(true)
		expect((parent as any).childTaskId).toBe("child-2")

		// Legacy events emitted (TaskPaused and TaskSpawned)
		const calls = (parent.emit as any).mock.calls
		const hasPaused = calls.some((c: any[]) => c[0] === RooCodeEventName.TaskPaused && c[1] === "parent-2")
		const hasSpawned = calls.some((c: any[]) => c[0] === RooCodeEventName.TaskSpawned && c[1] === "child-2")
		expect(hasPaused).toBe(true)
		expect(hasSpawned).toBe(true)

		// Delegation not used
		expect(provider.delegateParentAndOpenChild).not.toHaveBeenCalled()
	})
})
