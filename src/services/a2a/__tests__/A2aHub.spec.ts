import { A2aHub } from "../A2aHub"
import type { ClineProvider } from "../../../core/webview/ClineProvider"

// Mock dependencies
vi.mock("fs/promises", () => ({
	readFile: vi.fn().mockResolvedValue(JSON.stringify({ a2aAgents: {} })),
	writeFile: vi.fn().mockResolvedValue(undefined),
	mkdir: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("chokidar", () => ({
	default: {
		watch: vi.fn().mockReturnValue({
			on: vi.fn().mockReturnThis(),
			close: vi.fn().mockResolvedValue(undefined),
		}),
	},
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(false),
}))

vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn().mockReturnValue("/test/workspace"),
	arePathsEqual: vi.fn().mockReturnValue(false),
}))

vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn().mockResolvedValue(undefined),
}))

describe("A2aHub", () => {
	let mockProvider: Partial<ClineProvider>
	let a2aHub: A2aHub

	beforeEach(() => {
		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/test/storage" },
			} as any,
			postMessageToWebview: vi.fn(),
		}
		a2aHub = new A2aHub(mockProvider as ClineProvider)
	})

	afterEach(async () => {
		await a2aHub.dispose()
	})

	describe("constructor", () => {
		it("should create an A2aHub instance", () => {
			expect(a2aHub).toBeInstanceOf(A2aHub)
		})
	})

	describe("getAgents", () => {
		it("should return empty array when no agents are configured", () => {
			const agents = a2aHub.getAgents()
			expect(agents).toEqual([])
		})
	})

	describe("getAllAgents", () => {
		it("should return empty array when no agents are configured", () => {
			const agents = a2aHub.getAllAgents()
			expect(agents).toEqual([])
		})
	})

	describe("getAgent", () => {
		it("should return undefined when agent does not exist", () => {
			const agent = a2aHub.getAgent("nonexistent")
			expect(agent).toBeUndefined()
		})
	})

	describe("registerClient / unregisterClient", () => {
		it("should track client count", () => {
			a2aHub.registerClient()
			// Should not throw
			expect(a2aHub.getAgents()).toEqual([])
		})

		it("should dispose when last client unregisters", async () => {
			a2aHub.registerClient()
			await a2aHub.unregisterClient()
			// After disposal, agents should be empty
			expect(a2aHub.getAllAgents()).toEqual([])
		})
	})

	describe("sendTask", () => {
		it("should throw when agent is not found", async () => {
			await expect(a2aHub.sendTask("nonexistent", "test message")).rejects.toThrow(
				'A2A agent "nonexistent" not found or is disabled',
			)
		})
	})

	describe("getTask", () => {
		it("should throw when agent is not found", async () => {
			await expect(a2aHub.getTask("nonexistent", "task-1")).rejects.toThrow(
				'A2A agent "nonexistent" not found or is disabled',
			)
		})
	})

	describe("cancelTask", () => {
		it("should throw when agent is not found", async () => {
			await expect(a2aHub.cancelTask("nonexistent", "task-1")).rejects.toThrow(
				'A2A agent "nonexistent" not found or is disabled',
			)
		})
	})

	describe("getA2aSettingsFilePath", () => {
		it("should return empty string before initialization", async () => {
			const path = await a2aHub.getA2aSettingsFilePath()
			expect(path).toBe("")
		})
	})
})
