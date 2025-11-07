// npx vitest run __tests__/api-delegation-forwarding.spec.ts

import { API } from "../extension/api"
import { RooCodeEventName, type TaskProviderEvents, type TaskLike } from "@roo-code/types"

describe("API delegation event forwarding registration", () => {
	it("registers task-level listeners for delegation events", async () => {
		const mockOutput = { appendLine: vi.fn() } as any
		const providerOn = vi.fn()
		let onTaskCreated: ((task: TaskLike) => void) | undefined

		const mockProvider = {
			context: {} as any,
			on: (event: keyof TaskProviderEvents, listener: (...args: any[]) => any) => {
				providerOn(event, listener)
				if (event === RooCodeEventName.TaskCreated) {
					onTaskCreated = listener as any
				}
				return mockProvider
			},
			off: vi.fn(),
			postStateToWebview: vi.fn(),
			getValues: vi.fn(() => ({})),
			contextProxy: { setValues: vi.fn() },
			providerSettingsManager: { saveConfig: vi.fn() },
			postMessageToWebview: vi.fn(),
			removeClineFromStack: vi.fn(),
			getProviderProfileEntries: vi.fn(() => []),
			getProviderProfileEntry: vi.fn(),
			upsertProviderProfile: vi.fn(),
			deleteProviderProfile: vi.fn(),
			activateProviderProfile: vi.fn(),
			getCurrentTaskStack: vi.fn(() => []),
			getTaskWithId: vi.fn(),
			createTaskWithHistoryItem: vi.fn(),
			finishSubTask: vi.fn(),
			cancelTask: vi.fn(),
			viewLaunched: true,
		} as any

		const api = new API(mockOutput as any, mockProvider, undefined, false)
		expect(api).toBeTruthy()
		expect(providerOn).toHaveBeenCalled()

		const taskOn = vi.fn()
		const mockTask = {
			taskId: "parent",
			on: taskOn,
			off: vi.fn(),
		} as unknown as TaskLike

		expect(onTaskCreated).toBeDefined()
		onTaskCreated!(mockTask)

		const registered = taskOn.mock.calls.map((c: any[]) => c[0])
		expect(registered).toContain(RooCodeEventName.TaskDelegated)
		expect(registered).toContain(RooCodeEventName.TaskDelegationCompleted)
		expect(registered).toContain(RooCodeEventName.TaskDelegationResumed)
	})

	it("forwards TaskDelegated event from task to API with correct payload", () => {
		const mockOutput = { appendLine: vi.fn() } as any
		const apiEmit = vi.fn()
		let onTaskCreated: ((task: TaskLike) => void) | undefined

		const mockProvider = {
			context: {} as any,
			on: (event: keyof TaskProviderEvents, listener: (...args: any[]) => any) => {
				if (event === RooCodeEventName.TaskCreated) {
					onTaskCreated = listener as any
				}
				return mockProvider
			},
			off: vi.fn(),
			postStateToWebview: vi.fn(),
			getValues: vi.fn(() => ({})),
			contextProxy: { setValues: vi.fn() },
			providerSettingsManager: { saveConfig: vi.fn() },
			postMessageToWebview: vi.fn(),
			removeClineFromStack: vi.fn(),
			getProviderProfileEntries: vi.fn(() => []),
			getProviderProfileEntry: vi.fn(),
			upsertProviderProfile: vi.fn(),
			deleteProviderProfile: vi.fn(),
			activateProviderProfile: vi.fn(),
			getCurrentTaskStack: vi.fn(() => []),
			getTaskWithId: vi.fn(),
			createTaskWithHistoryItem: vi.fn(),
			finishSubTask: vi.fn(),
			cancelTask: vi.fn(),
			viewLaunched: true,
		} as any

		const api = new API(mockOutput as any, mockProvider, undefined, false)
		;(api as any).emit = apiEmit

		const taskEmit = vi.fn()
		const mockTask = {
			taskId: "parent-1",
			on: (event: string, listener: (...args: any[]) => void) => {
				taskEmit(event, listener)
				// Immediately trigger TaskDelegated to test forwarding
				if (event === RooCodeEventName.TaskDelegated) {
					listener("child-1")
				}
			},
			off: vi.fn(),
		} as unknown as TaskLike

		onTaskCreated!(mockTask)

		// Verify API emitted TaskDelegated with parent and child IDs
		expect(apiEmit).toHaveBeenCalledWith(RooCodeEventName.TaskDelegated, "parent-1", "child-1")
	})

	it("forwards TaskDelegationCompleted and TaskDelegationResumed with payloads", () => {
		const mockOutput = { appendLine: vi.fn() } as any
		const apiEmit = vi.fn()
		let onTaskCreated: ((task: TaskLike) => void) | undefined

		const mockProvider = {
			context: {} as any,
			on: (event: keyof TaskProviderEvents, listener: (...args: any[]) => any) => {
				if (event === RooCodeEventName.TaskCreated) {
					onTaskCreated = listener as any
				}
				return mockProvider
			},
			off: vi.fn(),
			postStateToWebview: vi.fn(),
			getValues: vi.fn(() => ({})),
			contextProxy: { setValues: vi.fn() },
			providerSettingsManager: { saveConfig: vi.fn() },
			postMessageToWebview: vi.fn(),
			removeClineFromStack: vi.fn(),
			getProviderProfileEntries: vi.fn(() => []),
			getProviderProfileEntry: vi.fn(),
			upsertProviderProfile: vi.fn(),
			deleteProviderProfile: vi.fn(),
			activateProviderProfile: vi.fn(),
			getCurrentTaskStack: vi.fn(() => []),
			getTaskWithId: vi.fn(),
			createTaskWithHistoryItem: vi.fn(),
			finishSubTask: vi.fn(),
			cancelTask: vi.fn(),
			viewLaunched: true,
		} as any

		const api = new API(mockOutput as any, mockProvider, undefined, false)
		;(api as any).emit = apiEmit

		let completedListener: ((...args: any[]) => void) | undefined
		let resumedListener: ((...args: any[]) => void) | undefined

		const mockTask = {
			taskId: "parent-2",
			on: (event: string, listener: (...args: any[]) => void) => {
				if (event === RooCodeEventName.TaskDelegationCompleted) {
					completedListener = listener
				}
				if (event === RooCodeEventName.TaskDelegationResumed) {
					resumedListener = listener
				}
			},
			off: vi.fn(),
		} as unknown as TaskLike

		onTaskCreated!(mockTask)

		// Trigger TaskDelegationCompleted
		expect(completedListener).toBeDefined()
		completedListener!("child-2", "Summary text")

		expect(apiEmit).toHaveBeenCalledWith(
			RooCodeEventName.TaskDelegationCompleted,
			"parent-2",
			"child-2",
			"Summary text",
		)

		// Trigger TaskDelegationResumed
		expect(resumedListener).toBeDefined()
		resumedListener!("child-2")

		expect(apiEmit).toHaveBeenCalledWith(RooCodeEventName.TaskDelegationResumed, "parent-2", "child-2")
	})
})
