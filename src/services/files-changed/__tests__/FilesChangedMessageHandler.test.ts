import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { EventEmitter } from "events"
import { FilesChangedMessageHandler } from "../FilesChangedMessageHandler"
import { FilesChangedManager } from "../FilesChangedManager"
import { TaskFilesChangedState } from "../TaskFilesChangedState"
import type { Task } from "../../../core/task/Task"
import { getCheckpointService } from "../../../core/checkpoints"

vi.mock("../../../core/checkpoints", () => ({
	getCheckpointService: vi.fn(async () => ({})),
}))

class MockCheckpointService extends EventEmitter {
	baseHash = "base-A"
	getCurrentCheckpoint = vi.fn().mockReturnValue("commit-B")
	getDiff = vi.fn(async () => [
		{
			paths: { relative: "app/foo.ts", newFile: false, deletedFile: false },
			content: { before: "console.log(1)\n", after: "console.log(2)\n" },
		},
	])
	getDiffStats = vi.fn(
		async (): Promise<Record<string, { insertions: number; deletions: number }>> => ({
			"app/foo.ts": { insertions: 1, deletions: 1 },
		}),
	)
	restoreFileFromCheckpoint = vi.fn(async () => {})
}

class MockFileContextTracker extends EventEmitter {
	getTaskMetadata = vi.fn(async () => ({
		files_in_context: [{ path: "app/foo.ts", record_source: "roo_edited" }],
	}))
}

describe("FilesChangedMessageHandler", () => {
	let handler: FilesChangedMessageHandler
	let checkpointService: MockCheckpointService
	let fileContextTracker: MockFileContextTracker
	let manager: FilesChangedManager
	let taskState: TaskFilesChangedState
	let posts: any[]
	let provider: any
	let currentTask: Task

	beforeEach(() => {
		vi.useFakeTimers()
		vi.mocked(getCheckpointService).mockReset()
		checkpointService = new MockCheckpointService()
		vi.mocked(getCheckpointService).mockResolvedValue(checkpointService as any)
		fileContextTracker = new MockFileContextTracker()
		posts = []

		taskState = new TaskFilesChangedState()
		manager = taskState.ensureManager()
		const task = {
			taskId: "task-1",
			checkpointService,
			fileContextTracker,
			ensureFilesChangedState: vi.fn(() => taskState),
			getFilesChangedState: vi.fn(() => taskState),
			disposeFilesChangedState: vi.fn(() => taskState.dispose()),
		} as unknown as Task
		currentTask = task

		provider = {
			log: vi.fn(),
			getCurrentTask: () => currentTask,
			getState: vi.fn(async () => ({
				experiments: {
					filesChangedOverview: { enabled: true },
				},
			})),
			postMessageToWebview: vi.fn((msg: any) => posts.push(msg)),
		}

		handler = new FilesChangedMessageHandler(provider)
	})

	afterEach(() => {
		vi.useRealTimers()
		handler.dispose()
	})

	const getLatestFilesMessage = () => posts.filter((m) => m.type === "filesChanged").pop()
	const advance = async () => {
		await vi.advanceTimersByTimeAsync(1200) // Increased to handle new 500-1000ms debounce timing
		await Promise.resolve()
	}
	const emitBaseline = async (service = checkpointService, fromHash = "commit-A", toHash = "commit-B") => {
		service.emit("checkpoint", { fromHash, toHash })
		await Promise.resolve()
	}

	it("requires a checkpoint baseline before processing edits", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())
		posts.length = 0

		fileContextTracker.emit("roo_edited", "app/foo.ts")
		await advance()
		expect(getLatestFilesMessage()).toBeUndefined()

		await emitBaseline()
		expect(taskState.isWaiting()).toBe(false)
		// Baseline establishment keeps the UI empty until a file edit arrives
		expect(getLatestFilesMessage()).toBeUndefined()

		posts.length = 0
		fileContextTracker.emit("roo_edited", "app/foo.ts")
		await advance()
		const message = getLatestFilesMessage()
		expect(checkpointService.getDiff).toHaveBeenLastCalledWith({ from: "commit-A" })
		expect(message?.filesChanged?.files?.[0]?.uri).toBe("app/foo.ts")
	})

	it("keeps newly attached tasks idle until their first checkpoint", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())
		await emitBaseline()

		posts.length = 0

		const secondCheckpointService = new MockCheckpointService()
		secondCheckpointService.baseHash = "base-B"
		secondCheckpointService.getDiff = vi.fn(async () => [
			{
				paths: { relative: "app/child.ts", newFile: false, deletedFile: false },
				content: { before: "console.log('a')\n", after: "console.log('b')\n" },
			},
		])
		secondCheckpointService.getDiffStats = vi.fn(async () => ({
			"app/child.ts": { insertions: 1, deletions: 0 },
		}))

		const secondTracker = new MockFileContextTracker()
		const secondState = new TaskFilesChangedState()
		const secondTask = {
			taskId: "task-2",
			checkpointService: secondCheckpointService,
			fileContextTracker: secondTracker,
			ensureFilesChangedState: vi.fn(() => secondState),
			getFilesChangedState: vi.fn(() => secondState),
			disposeFilesChangedState: vi.fn(() => secondState.dispose()),
		} as unknown as Task

		vi.mocked(getCheckpointService).mockImplementation(async (requestedTask: Task) =>
			requestedTask === secondTask ? (secondCheckpointService as any) : (checkpointService as any),
		)

		currentTask = secondTask
		await handler.applyExperimentsToTask(secondTask)

		expect(secondState.isWaiting()).toBe(true)
		posts.length = 0

		secondTracker.emit("roo_edited", "app/child.ts")
		await advance()
		expect(getLatestFilesMessage()).toBeUndefined()

		await emitBaseline(secondCheckpointService, "commit-C", "commit-D")
		expect(secondState.isWaiting()).toBe(false)

		await advance()
		const message = getLatestFilesMessage()
		expect(secondCheckpointService.getDiff).toHaveBeenCalledWith({ from: "commit-C" })
		expect(message?.filesChanged?.files?.[0]?.uri).toBe("app/child.ts")
	})

	it("keeps existing entries when additional files change", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())
		await emitBaseline()

		fileContextTracker.emit("roo_edited", "app/foo.ts")
		await advance()

		checkpointService.getDiff.mockResolvedValueOnce([
			{
				paths: { relative: "app/foo.ts", newFile: false, deletedFile: false },
				content: { before: "console.log(2)\n", after: "console.log(3)\n" },
			},
			{
				paths: { relative: "app/bar.ts", newFile: false, deletedFile: false },
				content: { before: "let x = 1\n", after: "let x = 2\n" },
			},
		])
		checkpointService.getDiffStats.mockResolvedValueOnce({
			"app/foo.ts": { insertions: 1, deletions: 1 },
			"app/bar.ts": { insertions: 1, deletions: 1 },
		})

		fileContextTracker.emit("roo_edited", "app/bar.ts")
		await advance()
		const message = getLatestFilesMessage()
		expect(message?.filesChanged?.files?.map((f: any) => f.uri).sort()).toEqual(["app/bar.ts", "app/foo.ts"])
	})

	it("rejects only the selected files when uris are provided", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())
		await emitBaseline()

		fileContextTracker.emit("roo_edited", "app/foo.ts")
		await advance()

		checkpointService.getDiff.mockResolvedValueOnce([
			{
				paths: { relative: "app/foo.ts", newFile: false, deletedFile: false },
				content: { before: "console.log(2)\n", after: "console.log(3)\n" },
			},
			{
				paths: { relative: "app/bar.ts", newFile: false, deletedFile: false },
				content: { before: "let x = 1\n", after: "let x = 5\n" },
			},
		])
		checkpointService.getDiffStats.mockResolvedValueOnce({
			"app/foo.ts": { insertions: 1, deletions: 1 },
			"app/bar.ts": { insertions: 1, deletions: 1 },
		})

		fileContextTracker.emit("roo_edited", "app/bar.ts")
		await advance()

		posts.length = 0
		checkpointService.restoreFileFromCheckpoint.mockClear()
		const rejectAllSpy = vi.spyOn(manager, "rejectAll")

		await handler.handleMessage({ type: "rejectAllFileChanges", uris: ["app/foo.ts"] } as any)

		expect(checkpointService.restoreFileFromCheckpoint).toHaveBeenCalledWith("commit-A", "app/foo.ts")
		expect(checkpointService.restoreFileFromCheckpoint).not.toHaveBeenCalledWith("commit-A", "app/bar.ts")
		expect(rejectAllSpy).not.toHaveBeenCalled()
		expect(taskState.isWaiting()).toBe(false)

		const latest = getLatestFilesMessage()
		expect(latest?.filesChanged?.files?.map((f: any) => f.uri)).toEqual(["app/bar.ts"])
		rejectAllSpy.mockRestore()
	})

	it("waits for a new checkpoint after accepting all changes", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())
		await emitBaseline()

		fileContextTracker.emit("roo_edited", "app/foo.ts")
		await advance()

		posts.length = 0
		await handler.handleMessage({ type: "acceptAllFileChanges" } as any)
		expect(getLatestFilesMessage()).toEqual({ type: "filesChanged", filesChanged: null })
		expect(taskState.isWaiting()).toBe(true)

		checkpointService.getDiff.mockClear()
		fileContextTracker.emit("roo_edited", "app/foo.ts")
		await advance()
		expect(getLatestFilesMessage()).toEqual({ type: "filesChanged", filesChanged: null })
		expect(checkpointService.getDiff).not.toHaveBeenCalled()

		await emitBaseline(checkpointService, "commit-C", "commit-D")
		checkpointService.getDiff.mockResolvedValueOnce([
			{
				paths: { relative: "app/foo.ts", newFile: false, deletedFile: false },
				content: { before: "console.log(3)\n", after: "console.log(4)\n" },
			},
		])

		fileContextTracker.emit("roo_edited", "app/foo.ts")
		await advance()
		expect(checkpointService.getDiff).toHaveBeenCalledWith({ from: "commit-C" })
		expect(getLatestFilesMessage()?.filesChanged?.files?.[0]?.uri).toBe("app/foo.ts")
		expect(taskState.isWaiting()).toBe(false)
	})

	it("applies completed child changes immediately when baseline is established", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())
		await emitBaseline()

		checkpointService.getDiff.mockResolvedValueOnce([
			{
				paths: { relative: "child.ts", newFile: true, deletedFile: false },
				content: { before: "", after: "console.log(5)\n" },
			},
		])
		checkpointService.getDiffStats.mockResolvedValueOnce({ "child.ts": { insertions: 1, deletions: 0 } })

		posts.length = 0
		handler.queueChildFiles(provider.getCurrentTask(), "task-2", ["child.ts"])
		await vi.waitUntil(() => Boolean(getLatestFilesMessage()?.filesChanged?.files?.length))

		expect(taskState.isWaiting()).toBe(false)
		const message = getLatestFilesMessage()
		expect(message?.filesChanged?.files?.map((f: any) => f.uri)).toEqual(["child.ts"])
	})

	it("defers child changes until parent baseline is ready", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())

		checkpointService.getDiff.mockResolvedValueOnce([
			{
				paths: { relative: "child.ts", newFile: true, deletedFile: false },
				content: { before: "", after: "console.log(5)\n" },
			},
		])
		checkpointService.getDiffStats.mockResolvedValueOnce({ "child.ts": { insertions: 1, deletions: 0 } })

		posts.length = 0
		handler.queueChildFiles(provider.getCurrentTask(), "task-2", ["child.ts"])
		expect(getLatestFilesMessage()).toBeUndefined()

		await emitBaseline(checkpointService, "commit-C", "commit-D")
		await vi.waitUntil(() => Boolean(getLatestFilesMessage()?.filesChanged?.files?.length))

		const message = getLatestFilesMessage()
		expect(message?.filesChanged?.files?.map((f: any) => f.uri)).toEqual(["child.ts"])
		expect(taskState.isWaiting()).toBe(false)
	})

	it("disposes Files Changed state when experiment is disabled", async () => {
		const currentTask = provider.getCurrentTask()
		await handler.handleExperimentToggle(true, currentTask)
		await handler.handleExperimentToggle(false, currentTask)
		expect(currentTask.disposeFilesChangedState).toHaveBeenCalled()
	})

	it("reverts a rejected file and removes it from the list", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())
		checkpointService.emit("checkpoint", { fromHash: "commit-A", toHash: "commit-B" })
		await Promise.resolve()

		manager.upsertFile({
			uri: "app/foo.ts",
			type: "edit",
			fromCheckpoint: "commit-A",
			toCheckpoint: "HEAD_WORKING",
			linesAdded: 1,
			linesRemoved: 1,
		})

		posts.length = 0
		const emitSpy = vi.spyOn(fileContextTracker, "emit")
		await handler.handleMessage({ type: "rejectFileChange", uri: "app/foo.ts" } as any)
		expect(checkpointService.restoreFileFromCheckpoint).toHaveBeenCalledWith("commit-A", "app/foo.ts")
		expect(emitSpy).toHaveBeenCalledWith("user_edited", "app/foo.ts")
		expect(getLatestFilesMessage()).toEqual({ type: "filesChanged", filesChanged: null })
	})

	it("recomputes all files when tracker emits wildcard", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())
		checkpointService.emit("checkpoint", { fromHash: "commit-A", toHash: "commit-B" })
		await Promise.resolve()

		checkpointService.getDiff.mockResolvedValueOnce([
			{
				paths: { relative: "app/foo.ts", newFile: false, deletedFile: false },
				content: { before: "console.log(1)\n", after: "console.log(2)\n" },
			},
		])
		checkpointService.getDiffStats.mockResolvedValueOnce({ "app/foo.ts": { insertions: 1, deletions: 1 } })

		fileContextTracker.emit("roo_edited", "app/foo.ts")
		await advance()

		checkpointService.getDiff.mockResolvedValueOnce([
			{
				paths: { relative: "app/foo.ts", newFile: false, deletedFile: false },
				content: { before: "console.log(2)\n", after: "console.log(3)\n" },
			},
			{
				paths: { relative: "app/bar.ts", newFile: false, deletedFile: false },
				content: { before: "let x = 1\n", after: "let x = 3\n" },
			},
		])
		checkpointService.getDiffStats.mockResolvedValueOnce({
			"app/foo.ts": { insertions: 1, deletions: 1 },
			"app/bar.ts": { insertions: 2, deletions: 0 },
		})

		posts.length = 0
		fileContextTracker.emit("roo_edited", "*")
		await advance()
		const message = getLatestFilesMessage()
		expect(message?.filesChanged?.files?.map((f: any) => f.uri).sort()).toEqual(["app/bar.ts", "app/foo.ts"])
	})

	it("does not clear queued diff updates when rehydrating task state", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())
		await emitBaseline()

		fileContextTracker.emit("roo_edited", "app/foo.ts")
		await advance()

		posts.length = 0
		const freshState = new TaskFilesChangedState()
		freshState.cloneFrom(taskState)
		const freshTask = {
			taskId: "task-1",
			checkpointService,
			fileContextTracker,
			ensureFilesChangedState: vi.fn(() => freshState),
			getFilesChangedState: vi.fn(() => freshState),
			disposeFilesChangedState: vi.fn(() => freshState.dispose()),
		} as unknown as Task

		const previousGetter = provider.getCurrentTask
		provider.getCurrentTask = () => freshTask
		await handler.applyExperimentsToTask(freshTask)
		provider.getCurrentTask = previousGetter

		const latest = getLatestFilesMessage()
		expect((latest?.filesChanged?.files ?? []).length).toBeGreaterThan(0)
	})

	it("clears pending tracker debounce when switching tasks", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())
		await emitBaseline()

		fileContextTracker.emit("roo_edited", "app/foo.ts")
		expect(vi.getTimerCount()).toBe(1)

		const nextState = new TaskFilesChangedState()
		const nextTask = {
			taskId: "task-2",
			checkpointService: new MockCheckpointService(),
			fileContextTracker: new MockFileContextTracker(),
			ensureFilesChangedState: vi.fn(() => nextState),
			getFilesChangedState: vi.fn(() => nextState),
			disposeFilesChangedState: vi.fn(() => nextState.dispose()),
		} as unknown as Task

		await handler.applyExperimentsToTask(nextTask)

		expect(vi.getTimerCount()).toBe(0)
	})

	it("logs and aborts enable when checkpoint service initialization fails", async () => {
		vi.mocked(getCheckpointService).mockRejectedValueOnce(new Error("nope"))

		await handler.handleExperimentToggle(true, provider.getCurrentTask())

		expect(provider.log).toHaveBeenCalledWith(expect.stringContaining("Failed to initialize checkpoint service"))
		expect(fileContextTracker.listenerCount("roo_edited")).toBe(0)
	})

	it("maintains existing files when queued child URIs drain immediately", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())
		await emitBaseline()

		checkpointService.getDiff.mockResolvedValueOnce([
			{
				paths: { relative: "app/foo.ts", newFile: false, deletedFile: false },
				content: { before: "console.log(1)\n", after: "console.log(2)\n" },
			},
		])
		checkpointService.getDiffStats.mockResolvedValueOnce({ "app/foo.ts": { insertions: 1, deletions: 0 } })

		fileContextTracker.emit("roo_edited", "app/foo.ts")
		await advance()
		posts.length = 0

		const combinedDiff = [
			{
				paths: { relative: "app/foo.ts", newFile: false, deletedFile: false },
				content: { before: "console.log(2)\n", after: "console.log(3)\n" },
			},
			{
				paths: { relative: "child.ts", newFile: true, deletedFile: false },
				content: { before: "", after: "export const child = 1\n" },
			},
		]
		checkpointService.getDiff.mockResolvedValue(combinedDiff)
		checkpointService.getDiffStats.mockResolvedValue({
			"app/foo.ts": { insertions: 1, deletions: 0 },
			"child.ts": { insertions: 1, deletions: 0 },
		})

		handler.queueChildFiles(provider.getCurrentTask(), "child-task", ["child.ts"])
		await vi.waitUntil(() => Boolean(getLatestFilesMessage()?.filesChanged))

		const uris = (getLatestFilesMessage()?.filesChanged?.files ?? []).map((f: any) => f.uri)
		expect(uris.sort()).toEqual(["app/foo.ts", "child.ts"].sort())
	})

	it("reattaches listeners when switching to a subtask", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())
		checkpointService.emit("checkpoint", { fromHash: "commit-A", toHash: "commit-B" })
		await Promise.resolve()

		fileContextTracker.emit("roo_edited", "app/foo.ts")
		await advance()
		expect(manager.getChanges().baseCheckpoint).toBe("commit-A")

		const childTracker = new MockFileContextTracker()
		const childCheckpoint = new MockCheckpointService()
		childCheckpoint.getDiff.mockResolvedValueOnce([
			{
				paths: { relative: "child.ts", newFile: true, deletedFile: false },
				content: { before: "", after: "console.log(5)\n" },
			},
		])
		childCheckpoint.getDiffStats.mockResolvedValueOnce({
			"child.ts": { insertions: 1, deletions: 0 },
		})

		const childState = new TaskFilesChangedState()
		const childTask = {
			taskId: "task-2",
			parentTask: { taskId: "task-1" },
			checkpointService: childCheckpoint,
			fileContextTracker: childTracker,
			ensureFilesChangedState: vi.fn(() => childState),
			getFilesChangedState: vi.fn(() => childState),
			disposeFilesChangedState: vi.fn(() => childState.dispose()),
		} as unknown as Task

		provider.getCurrentTask = () => childTask
		await handler.applyExperimentsToTask(childTask)
		expect(childTracker.listenerCount("roo_edited")).toBeGreaterThan(0)

		childCheckpoint.emit("checkpoint", { fromHash: "commit-A", toHash: "commit-B" })
		await Promise.resolve()
		childCheckpoint.getDiff.mockResolvedValueOnce([
			{
				paths: { relative: "child.ts", newFile: true, deletedFile: false },
				content: { before: "", after: "console.log(5)\n" },
			},
		])
		childCheckpoint.getDiffStats.mockResolvedValueOnce({ "child.ts": { insertions: 1, deletions: 0 } })

		provider.getCurrentTask = () => childTask
		expect(childState.isWaiting()).toBe(false)
		await (handler as any).refreshEditedFile(childTask, "child.ts")
		expect(childCheckpoint.getDiff).toHaveBeenCalledWith({ from: "commit-A" })
		const uris =
			childState
				.getManager()
				?.getChanges()
				.files.map((f) => f.uri) ?? []
		expect(uris).toContain("child.ts")
	})

	it("disposes Files Changed state on handler dispose", () => {
		handler.dispose()
		expect(provider.getCurrentTask().disposeFilesChangedState).toHaveBeenCalled()
	})

	it("queues child URIs when child task completes while waiting for baseline", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())

		const childState = new TaskFilesChangedState()
		const childManager = childState.ensureManager()
		childManager.upsertFile({
			uri: "child.ts",
			type: "edit",
			fromCheckpoint: "commit-A",
			toCheckpoint: "HEAD_WORKING",
			linesAdded: 1,
			linesRemoved: 0,
		})
		const childTask = {
			taskId: "task-child",
			checkpointService,
			fileContextTracker,
			ensureFilesChangedState: vi.fn(() => childState),
			getFilesChangedState: vi.fn(() => childState),
			disposeFilesChangedState: vi.fn(() => childState.dispose()),
		} as unknown as Task

		handler.handleChildTaskCompletion(childTask, provider.getCurrentTask())

		expect(taskState.hasQueuedChildUris()).toBe(true)
		expect(taskState.isWaiting()).toBe(true)
		expect(childTask.disposeFilesChangedState).toHaveBeenCalled()
	})

	it("deduplicates queued child URIs", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())

		const firstChildState = new TaskFilesChangedState()
		firstChildState.ensureManager().upsertFile({
			uri: "child.ts",
			type: "edit",
			fromCheckpoint: "commit-A",
			toCheckpoint: "HEAD_WORKING",
			linesAdded: 1,
			linesRemoved: 0,
		})
		const firstChildTask = {
			taskId: "task-child-1",
			checkpointService,
			fileContextTracker,
			ensureFilesChangedState: vi.fn(() => firstChildState),
			getFilesChangedState: vi.fn(() => firstChildState),
			disposeFilesChangedState: vi.fn(() => firstChildState.dispose()),
		} as unknown as Task

		handler.handleChildTaskCompletion(firstChildTask, provider.getCurrentTask())
		expect(taskState.hasQueuedChildUris()).toBe(true)

		const secondChildState = new TaskFilesChangedState()
		secondChildState.ensureManager().upsertFile({
			uri: "child.ts",
			type: "edit",
			fromCheckpoint: "commit-B",
			toCheckpoint: "HEAD_WORKING",
			linesAdded: 2,
			linesRemoved: 0,
		})
		const secondChildTask = {
			taskId: "task-child-2",
			checkpointService,
			fileContextTracker,
			ensureFilesChangedState: vi.fn(() => secondChildState),
			getFilesChangedState: vi.fn(() => secondChildState),
			disposeFilesChangedState: vi.fn(() => secondChildState.dispose()),
		} as unknown as Task

		handler.handleChildTaskCompletion(secondChildTask, provider.getCurrentTask())
		expect(taskState.hasQueuedChildUris()).toBe(true)
		await Promise.resolve()
		const queued = taskState.takeQueuedChildUris()
		expect(queued).toEqual(["child.ts"])
	})

	it("transfers state between matching tasks", () => {
		const sourceState = new TaskFilesChangedState()
		sourceState.ensureManager().upsertFile({
			uri: "shared.ts",
			type: "edit",
			fromCheckpoint: "commit-root",
			toCheckpoint: "HEAD_WORKING",
			linesAdded: 3,
			linesRemoved: 1,
		})
		sourceState.queueChildUris(["child-a.ts"])
		sourceState.setWaiting(true)

		const sourceTask = {
			taskId: "task-1",
			getFilesChangedState: vi.fn(() => sourceState),
			disposeFilesChangedState: vi.fn(() => sourceState.dispose()),
		} as unknown as Task

		const targetState = new TaskFilesChangedState()
		const targetTask = {
			taskId: "task-1",
			ensureFilesChangedState: vi.fn(() => targetState),
			getFilesChangedState: vi.fn(() => targetState),
		} as unknown as Task

		handler.transferStateBetweenTasks(sourceTask, targetTask)

		expect(
			targetState
				.getManager()
				?.getChanges()
				.files.map((f) => f.uri),
		).toContain("shared.ts")
		expect(targetState.hasQueuedChildUris()).toBe(true)
		expect(sourceTask.disposeFilesChangedState).toHaveBeenCalled()
	})

	it("reject handler emits user_edited instead of roo_edited", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())
		const task = provider.getCurrentTask()

		// Set up file to be rejected
		taskState.ensureManager().upsertFile({
			uri: "test-reject.ts",
			type: "edit",
			fromCheckpoint: "commit-A",
			toCheckpoint: "HEAD_WORKING",
			linesAdded: 1,
			linesRemoved: 0,
		})

		// Mock fileContextTracker emit to capture the event
		const emitSpy = vi.fn()
		task.fileContextTracker.emit = emitSpy

		// Reject the file
		await (handler as any).handleRejectFileChange({
			type: "rejectFileChange",
			uri: "test-reject.ts",
		})

		// Verify user_edited event was emitted, not roo_edited
		expect(emitSpy).toHaveBeenCalledWith("user_edited", "test-reject.ts")
		expect(emitSpy).not.toHaveBeenCalledWith("roo_edited", "test-reject.ts")

		// Verify file was removed from FCO
		const manager = taskState.getManager()
		expect(manager?.getChanges().files.find((f) => f.uri === "test-reject.ts")).toBeUndefined()
	})

	it("cancel task preserves FCO state", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())

		// Set up some files in FCO
		taskState.ensureManager().upsertFile({
			uri: "file1.ts",
			type: "edit",
			fromCheckpoint: "commit-A",
			toCheckpoint: "HEAD_WORKING",
			linesAdded: 2,
			linesRemoved: 1,
		})

		taskState.ensureManager().upsertFile({
			uri: "file2.ts",
			type: "create",
			fromCheckpoint: "commit-A",
			toCheckpoint: "HEAD_WORKING",
			linesAdded: 10,
			linesRemoved: 0,
		})

		// Capture the original state
		const originalFiles = taskState.getManager()?.getChanges().files || []
		expect(originalFiles).toHaveLength(2)

		// Simulate FCO state restoration after cancel (this is the fix we made)
		const capturedState = new TaskFilesChangedState()
		capturedState.cloneFrom(taskState)

		// Verify the captured state has the files
		expect(capturedState.getManager()?.getChanges().files).toHaveLength(2)

		// Verify waiting state can be controlled
		capturedState.setWaiting(false)
		expect(capturedState.isWaiting()).toBe(false)
		expect(capturedState.shouldWaitForNextCheckpoint()).toBe(false)
	})

	it("handles child task completion with fallback for missed roo_edited events", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())
		const task = provider.getCurrentTask()

		// Create a child task that has checkpoint service but no FCO files (simulating missed roo_edited events)
		const childTaskState = new TaskFilesChangedState()
		const childManager = childTaskState.ensureManager()
		childManager.reset("commit-child-baseline")
		const childCheckpointService = {
			baseHash: undefined,
			getCurrentCheckpoint: vi.fn(() => undefined),
			getDiff: vi.fn().mockResolvedValue([
				{
					paths: { relative: "missed-file.ts", absolute: "/abs/path/missed-file.ts" },
					content: { before: "old content", after: "new content" },
				},
			]),
		}

		const childTask = {
			taskId: "child-task-123",
			getFilesChangedState: () => childTaskState,
			disposeFilesChangedState: vi.fn(),
			checkpointService: childCheckpointService,
		} as unknown as Task

		// Before completion, child should have no tracked files (simulating the bug)
		expect(childTaskState.collectCurrentFileUris()).toEqual([])

		// Handle child completion - should trigger fallback
		await handler.handleChildTaskCompletion(childTask, task)

		// Verify fallback was triggered - checkpoint service should have been called
		expect(childCheckpointService.getDiff).toHaveBeenCalledWith({ from: "commit-child-baseline" })

		// Verify the files were queued despite not being tracked through roo_edited events
		const parentState = task.getFilesChangedState()
		expect(parentState?.hasQueuedChildUris()).toBe(true)
	})

	it("fallback gracefully handles missing HEAD~1 reference", async () => {
		await handler.handleExperimentToggle(true, provider.getCurrentTask())
		const task = provider.getCurrentTask()

		const childTaskState = new TaskFilesChangedState()
		const childCheckpointService = {
			baseHash: undefined,
			getCurrentCheckpoint: vi.fn(() => undefined),
			getDiff: vi.fn(),
		}

		const childTask = {
			taskId: "child-missing-head",
			getFilesChangedState: () => childTaskState,
			disposeFilesChangedState: vi.fn(),
			checkpointService: childCheckpointService,
		} as unknown as Task

		expect(() => handler.handleChildTaskCompletion(childTask, task)).not.toThrow()
		expect(childCheckpointService.getDiff).not.toHaveBeenCalled()
	})
})
