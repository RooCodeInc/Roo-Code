// npx vitest run __tests__/ipc-start-new-task-during-delegation.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as ProfileValidatorMod from "../shared/ProfileValidator"

// Mock Task class to avoid heavy initialization
vi.mock("../core/task/Task", () => {
	class TaskStub {
		public taskId: string
		public instanceId = "inst"
		public parentTask?: any
		public apiConfiguration: any
		constructor(opts: any) {
			this.taskId = opts.historyItem?.id ?? `task-${Math.random().toString(36).slice(2, 8)}`
			this.parentTask = opts.parentTask
			this.apiConfiguration = opts.apiConfiguration ?? { apiProvider: "anthropic" }
			opts.onCreated?.(this)
		}
		on() {}
		off() {}
		emit() {}
	}
	return { Task: TaskStub }
})

import { ClineProvider } from "../core/webview/ClineProvider"

describe("IPC StartNewTask during delegation - single-open-task invariant", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.restoreAllMocks()
	})

	it("createTask with no parentTask closes existing task (single-open invariant)", async () => {
		vi.spyOn(ProfileValidatorMod.ProfileValidator, "isProfileAllowed").mockReturnValue(true)

		const removeClineFromStack = vi.fn().mockResolvedValue(undefined)
		const addClineToStack = vi.fn().mockResolvedValue(undefined)
		const mockCurrentTask = { taskId: "existing-1", parentTask: null }

		const provider = {
			clineStack: [mockCurrentTask],
			setValues: vi.fn().mockResolvedValue(undefined),
			getState: vi.fn().mockResolvedValue({
				apiConfiguration: { apiProvider: "anthropic", consecutiveMistakeLimit: 0 },
				organizationAllowList: "*",
				diffEnabled: false,
				enableCheckpoints: true,
				checkpointTimeout: 60,
				fuzzyMatchThreshold: 1.0,
				cloudUserInfo: null,
				remoteControlEnabled: false,
			}),
			removeClineFromStack,
			addClineToStack,
			setProviderProfile: vi.fn(),
			log: vi.fn(),
			getStateToPostToWebview: vi.fn(),
			providerSettingsManager: { getModeConfigId: vi.fn(), listConfig: vi.fn() },
			customModesManager: { getCustomModes: vi.fn().mockResolvedValue([]) },
			taskCreationCallback: vi.fn(),
			contextProxy: {
				extensionUri: {},
				setValue: vi.fn(),
				getValue: vi.fn(),
				setProviderSettings: vi.fn(),
				getProviderSettings: vi.fn(() => ({})),
			},
		} as unknown as ClineProvider

		// Simulate IPC startNewTask call (no parentTask argument)
		await (ClineProvider.prototype as any).createTask.call(
			provider,
			"New top-level task from IPC",
			undefined,
			undefined, // no parentTask
			{},
			{},
		)

		// CRITICAL: existing task must be closed BEFORE new task created (single-open invariant)
		expect(removeClineFromStack).toHaveBeenCalledTimes(1)
		expect(addClineToStack).toHaveBeenCalledTimes(1)

		// Verify ordering: remove before add
		const removeOrder = removeClineFromStack.mock.invocationCallOrder[0]
		const addOrder = addClineToStack.mock.invocationCallOrder[0]
		expect(removeOrder).toBeLessThan(addOrder)
	})

	it("createTask with parentTask does NOT enforce single-open (child of running parent)", async () => {
		vi.spyOn(ProfileValidatorMod.ProfileValidator, "isProfileAllowed").mockReturnValue(true)

		const removeClineFromStack = vi.fn().mockResolvedValue(undefined)
		const addClineToStack = vi.fn().mockResolvedValue(undefined)
		const parentTask = { taskId: "parent-1" }

		const provider = {
			clineStack: [parentTask],
			setValues: vi.fn().mockResolvedValue(undefined),
			getState: vi.fn().mockResolvedValue({
				apiConfiguration: { apiProvider: "anthropic", consecutiveMistakeLimit: 0 },
				organizationAllowList: "*",
				diffEnabled: false,
				enableCheckpoints: true,
				checkpointTimeout: 60,
				fuzzyMatchThreshold: 1.0,
				cloudUserInfo: null,
				remoteControlEnabled: false,
			}),
			removeClineFromStack,
			addClineToStack,
			setProviderProfile: vi.fn(),
			log: vi.fn(),
			getStateToPostToWebview: vi.fn(),
			providerSettingsManager: { getModeConfigId: vi.fn(), listConfig: vi.fn() },
			customModesManager: { getCustomModes: vi.fn().mockResolvedValue([]) },
			taskCreationCallback: vi.fn(),
			contextProxy: {
				extensionUri: {},
				setValue: vi.fn(),
				getValue: vi.fn(),
				setProviderSettings: vi.fn(),
				getProviderSettings: vi.fn(() => ({})),
			},
		} as unknown as ClineProvider

		// Subtask creation internally (has parentTask)
		await (ClineProvider.prototype as any).createTask.call(
			provider,
			"Child subtask",
			undefined,
			parentTask as any, // parentTask present
			{},
			{},
		)

		// When parentTask is provided, single-open invariant NOT enforced
		expect(removeClineFromStack).not.toHaveBeenCalled()
		expect(addClineToStack).toHaveBeenCalledTimes(1)
	})

	it("External IPC start does not corrupt delegation metadata relationships", async () => {
		vi.spyOn(ProfileValidatorMod.ProfileValidator, "isProfileAllowed").mockReturnValue(true)

		const getTaskWithId = vi.fn().mockResolvedValue({
			historyItem: {
				id: "parent-delegated",
				status: "delegated",
				delegatedToId: "child-active",
				awaitingChildId: "child-active",
				childIds: ["child-active"],
				ts: 100,
				task: "Parent delegated",
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			},
		})

		const removeClineFromStack = vi.fn().mockResolvedValue(undefined)
		const addClineToStack = vi.fn().mockResolvedValue(undefined)
		const currentChild = { taskId: "child-active", parentTask: { taskId: "parent-delegated" } }

		const provider = {
			clineStack: [currentChild],
			setValues: vi.fn().mockResolvedValue(undefined),
			getState: vi.fn().mockResolvedValue({
				experiments: {},
				apiConfiguration: { apiProvider: "anthropic", consecutiveMistakeLimit: 0 },
				organizationAllowList: "*",
				diffEnabled: false,
				enableCheckpoints: true,
				checkpointTimeout: 60,
				fuzzyMatchThreshold: 1.0,
				cloudUserInfo: null,
				remoteControlEnabled: false,
			}),
			removeClineFromStack,
			addClineToStack,
			getTaskWithId,
			setProviderProfile: vi.fn(),
			log: vi.fn(),
			getStateToPostToWebview: vi.fn(),
			providerSettingsManager: { getModeConfigId: vi.fn(), listConfig: vi.fn() },
			customModesManager: { getCustomModes: vi.fn().mockResolvedValue([]) },
			taskCreationCallback: vi.fn(),
			contextProxy: {
				extensionUri: {},
				setValue: vi.fn(),
				getValue: vi.fn(),
				setProviderSettings: vi.fn(),
				getProviderSettings: vi.fn(() => ({})),
			},
		} as unknown as ClineProvider

		// Simulate external IPC call to start new top-level task while child is running
		await (ClineProvider.prototype as any).createTask.call(
			provider,
			"External IPC task",
			undefined,
			undefined, // no parentTask
			{},
			{},
		)

		// Single-open invariant: child closed
		expect(removeClineFromStack).toHaveBeenCalledTimes(1)

		// Parent metadata NOT modified (still delegated, awaiting child-active)
		// The external task is independent; parent metadata unchanged
		expect(getTaskWithId).not.toHaveBeenCalled()
	})

	it("Handles missing experiments gracefully (single-open always enforced)", async () => {
		vi.spyOn(ProfileValidatorMod.ProfileValidator, "isProfileAllowed").mockReturnValue(true)

		const removeClineFromStack = vi.fn().mockResolvedValue(undefined)
		const addClineToStack = vi.fn().mockResolvedValue(undefined)
		const existingTask = { taskId: "fallback-1" }

		// Mock getState to succeed but return experiments: undefined
		const provider = {
			clineStack: [existingTask],
			setValues: vi.fn().mockResolvedValue(undefined),
			getState: vi.fn().mockResolvedValue({
				experiments: undefined,
				apiConfiguration: { apiProvider: "anthropic", consecutiveMistakeLimit: 0 },
				organizationAllowList: "*",
				diffEnabled: false,
				enableCheckpoints: true,
				checkpointTimeout: 60,
				fuzzyMatchThreshold: 1.0,
				cloudUserInfo: null,
				remoteControlEnabled: false,
			}),
			removeClineFromStack,
			addClineToStack,
			setProviderProfile: vi.fn(),
			log: vi.fn(),
			getStateToPostToWebview: vi.fn(),
			providerSettingsManager: { getModeConfigId: vi.fn(), listConfig: vi.fn() },
			customModesManager: { getCustomModes: vi.fn().mockResolvedValue([]) },
			taskCreationCallback: vi.fn(),
			contextProxy: {
				extensionUri: {},
				setValue: vi.fn(),
				getValue: vi.fn(),
				setProviderSettings: vi.fn(),
				getProviderSettings: vi.fn(() => ({})),
			},
		} as unknown as ClineProvider

		// Should not throw and enforce single-open-task
		await expect(
			(ClineProvider.prototype as any).createTask.call(provider, "Task", undefined, undefined, {}, {}),
		).resolves.toBeDefined()

		// Single-open-task always enforced (no experiment flag needed)
		expect(removeClineFromStack).toHaveBeenCalledTimes(1)
	})

	it("Single-open enforced when stack has multiple tasks but top is NOT subtask", async () => {
		vi.spyOn(ProfileValidatorMod.ProfileValidator, "isProfileAllowed").mockReturnValue(true)

		const removeClineFromStack = vi.fn().mockResolvedValue(undefined)
		const addClineToStack = vi.fn().mockResolvedValue(undefined)
		const task1 = { taskId: "task1", parentTask: null }
		const task2 = { taskId: "task2", parentTask: null }

		const provider = {
			clineStack: [task1, task2],
			setValues: vi.fn().mockResolvedValue(undefined),
			getState: vi.fn().mockResolvedValue({
				experiments: {},
				apiConfiguration: { apiProvider: "anthropic", consecutiveMistakeLimit: 0 },
				organizationAllowList: "*",
				diffEnabled: false,
				enableCheckpoints: true,
				checkpointTimeout: 60,
				fuzzyMatchThreshold: 1.0,
				cloudUserInfo: null,
				remoteControlEnabled: false,
			}),
			removeClineFromStack,
			addClineToStack,
			setProviderProfile: vi.fn(),
			log: vi.fn(),
			getStateToPostToWebview: vi.fn(),
			providerSettingsManager: { getModeConfigId: vi.fn(), listConfig: vi.fn() },
			customModesManager: { getCustomModes: vi.fn().mockResolvedValue([]) },
			taskCreationCallback: vi.fn(),
			contextProxy: {
				extensionUri: {},
				setValue: vi.fn(),
				getValue: vi.fn(),
				setProviderSettings: vi.fn(),
				getProviderSettings: vi.fn(() => ({})),
			},
		} as unknown as ClineProvider

		// Start another top-level task
		await (ClineProvider.prototype as any).createTask.call(provider, "Task3", undefined, undefined, {}, {})

		// Must close existing task
		expect(removeClineFromStack).toHaveBeenCalledTimes(1)
	})
})
