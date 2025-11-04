import { describe, it, expect, vi, beforeEach } from "vitest"
import { webviewMessageHandler } from "../webviewMessageHandler"

describe("webviewMessageHandler - resume gating on checkpointRestore", () => {
	let mockProvider: any

	beforeEach(() => {
		vi.clearAllMocks()

		const mockCline = {
			isInitialized: true,
			checkpointRestore: vi.fn().mockResolvedValue(undefined),
		}

		mockProvider = {
			beginStateTransaction: vi.fn(),
			endStateTransaction: vi.fn().mockResolvedValue(undefined),
			setSuppressResumeAsk: vi.fn(),
			cancelTask: vi.fn().mockResolvedValue(undefined),
			getCurrentTask: vi.fn(() => mockCline),
		}
	})

	it("sets suppressResumeAsk around cancel + restore flow", async () => {
		await webviewMessageHandler(mockProvider, {
			type: "checkpointRestore",
			payload: {
				commitHash: "abc123",
				ts: Date.now(),
				mode: "restore",
			},
		} as any)

		// Ensure gating is toggled on then off
		expect(mockProvider.setSuppressResumeAsk).toHaveBeenCalledWith(true)
		expect(mockProvider.cancelTask).toHaveBeenCalledTimes(1)
		expect(mockProvider.endStateTransaction).toHaveBeenCalledTimes(1)
		expect(mockProvider.setSuppressResumeAsk).toHaveBeenLastCalledWith(false)
	})
})
