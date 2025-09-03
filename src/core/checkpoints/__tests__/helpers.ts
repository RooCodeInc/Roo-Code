import { vitest } from "vitest"

export const createMockTask = (options: {
	taskId: string
	hasExistingCheckpoints?: boolean
	enableCheckpoints?: boolean
	provider?: any
}) => {
	const mockTask = {
		taskId: options.taskId,
		instanceId: "test-instance",
		rootTask: undefined as any,
		parentTask: undefined as any,
		taskNumber: 1,
		workspacePath: "/mock/workspace",
		enableCheckpoints: options.enableCheckpoints ?? true,
		checkpointService: null as any,
		checkpointServiceInitializing: false,
		ongoingCheckpointSaves: new Map(),
		clineMessages: options.hasExistingCheckpoints
			? [{ say: "checkpoint_saved", ts: Date.now(), text: "existing-checkpoint-hash" }]
			: [],
		providerRef: {
			deref: () => options.provider || createMockProvider(),
		},
		fileContextTracker: {},
		todoList: undefined,
	}

	return mockTask
}

export const createMockProvider = () => ({
	getFileChangeManager: vitest.fn(),
	ensureFileChangeManager: vitest.fn(),
	log: vitest.fn(),
	postMessageToWebview: vitest.fn(),
	getGlobalState: vitest.fn(),
})

// Mock checkpoint service for testing
export const createMockCheckpointService = () => ({
	saveCheckpoint: vitest.fn().mockResolvedValue({
		commit: "mock-checkpoint-hash",
		message: "Mock checkpoint",
	}),
	restoreCheckpoint: vitest.fn().mockResolvedValue(true),
	getDiff: vitest.fn().mockResolvedValue([]),
	getCheckpoints: vitest.fn().mockReturnValue([]),
	getCurrentCheckpoint: vitest.fn().mockReturnValue("mock-current-checkpoint"),
	initShadowGit: vitest.fn().mockResolvedValue(true),
	baseHash: "mock-base-hash",
})
