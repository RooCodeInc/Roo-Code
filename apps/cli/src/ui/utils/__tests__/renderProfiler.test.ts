/**
 * Tests for RenderProfiler utility
 */

import * as fs from "fs"
import * as os from "os"
import { RenderProfiler, getRenderLogPath, isProfilingEnabled } from "../renderProfiler.js"

// Mock fs module
vi.mock("fs", async () => {
	const actual = await vi.importActual<typeof fs>("fs")
	return {
		...actual,
		existsSync: vi.fn(() => true),
		mkdirSync: vi.fn(),
		appendFileSync: vi.fn(),
	}
})

describe("RenderProfiler", () => {
	beforeEach(() => {
		// Reset singleton between tests
		RenderProfiler.resetInstance()
		vi.clearAllMocks()
	})

	afterEach(() => {
		RenderProfiler.resetInstance()
	})

	describe("getInstance", () => {
		it("should return the same instance (singleton)", () => {
			const instance1 = RenderProfiler.getInstance()
			const instance2 = RenderProfiler.getInstance()
			expect(instance1).toBe(instance2)
		})
	})

	describe("configure", () => {
		it("should enable profiling when configured", () => {
			const profiler = RenderProfiler.getInstance()
			expect(profiler.isEnabled()).toBe(false)

			profiler.configure({ enabled: true })
			expect(profiler.isEnabled()).toBe(true)
		})

		it("should merge partial configuration", () => {
			const profiler = RenderProfiler.getInstance()
			profiler.configure({ enabled: true, slowRenderThreshold: 32 })

			const config = profiler.getConfig()
			expect(config.enabled).toBe(true)
			expect(config.slowRenderThreshold).toBe(32)
			expect(config.aggregateInterval).toBe(5000) // default
		})

		it("should write config log when enabled", () => {
			const profiler = RenderProfiler.getInstance()
			profiler.configure({ enabled: true })

			expect(fs.appendFileSync).toHaveBeenCalled()
		})
	})

	describe("recordRender", () => {
		it("should not record when profiling is disabled", () => {
			const profiler = RenderProfiler.getInstance()
			profiler.recordRender("TestComponent", 5.0, "test reason")

			const summary = profiler.getSummary()
			expect(summary.totalRenders).toBe(0)
		})

		it("should record render events when enabled", () => {
			const profiler = RenderProfiler.getInstance()
			profiler.configure({ enabled: true, logComponents: false })

			profiler.recordRender("TestComponent", 5.0, "test reason")
			profiler.recordRender("TestComponent", 3.0)
			profiler.recordRender("OtherComponent", 2.0)

			const summary = profiler.getSummary()
			expect(summary.totalRenders).toBe(3)
			expect(summary.componentBreakdown["TestComponent"]).toBeDefined()
			expect(summary.componentBreakdown["TestComponent"]?.count).toBe(2)
			expect(summary.componentBreakdown["OtherComponent"]?.count).toBe(1)
		})

		it("should calculate average and max times correctly", () => {
			const profiler = RenderProfiler.getInstance()
			profiler.configure({ enabled: true, logComponents: false })

			profiler.recordRender("TestComponent", 2.0)
			profiler.recordRender("TestComponent", 4.0)
			profiler.recordRender("TestComponent", 6.0)

			const summary = profiler.getSummary()
			expect(summary.componentBreakdown["TestComponent"]?.avgMs).toBe(4)
			expect(summary.componentBreakdown["TestComponent"]?.maxMs).toBe(6)
		})
	})

	describe("recordStoreUpdate", () => {
		it("should not record when profiling is disabled", () => {
			const profiler = RenderProfiler.getInstance()
			profiler.recordStoreUpdate("TestStore", "set", 1.0)

			const summary = profiler.getSummary()
			expect(Object.keys(summary.storeUpdates)).toHaveLength(0)
		})

		it("should record store updates when enabled", () => {
			const profiler = RenderProfiler.getInstance()
			profiler.configure({ enabled: true, logStoreUpdates: false })

			profiler.recordStoreUpdate("CLIStore", "set(messages)", 1.5)
			profiler.recordStoreUpdate("CLIStore", "set(messages)", 2.0)
			profiler.recordStoreUpdate("UIStore", "set(focus)", 0.5)

			const summary = profiler.getSummary()
			expect(summary.storeUpdates["CLIStore:set(messages)"]?.count).toBe(2)
			expect(summary.storeUpdates["UIStore:set(focus)"]?.count).toBe(1)
		})
	})

	describe("recordFrameTime", () => {
		it("should record frame timing when enabled", () => {
			const profiler = RenderProfiler.getInstance()
			profiler.configure({ enabled: true, logFrameTiming: false })

			profiler.recordFrameTime(8.0)
			profiler.recordFrameTime(16.0)
			profiler.recordFrameTime(32.0)

			const stats = profiler.getFrameStats()
			expect(stats).not.toBeNull()
			expect(stats?.measurements).toBe(3)
			expect(stats?.avgMs).toBeCloseTo(18.67, 1)
			expect(stats?.maxMs).toBe(32)
		})

		it("should limit measurements to 1000", () => {
			const profiler = RenderProfiler.getInstance()
			profiler.configure({ enabled: true, logFrameTiming: false })

			// Add 1100 measurements
			for (let i = 0; i < 1100; i++) {
				profiler.recordFrameTime(10.0)
			}

			const stats = profiler.getFrameStats()
			expect(stats?.measurements).toBe(1000)
		})
	})

	describe("getSummary", () => {
		it("should return empty summary when no data", () => {
			const profiler = RenderProfiler.getInstance()
			profiler.configure({ enabled: true })

			const summary = profiler.getSummary()
			expect(summary.totalRenders).toBe(0)
			expect(Object.keys(summary.componentBreakdown)).toHaveLength(0)
			expect(Object.keys(summary.storeUpdates)).toHaveLength(0)
		})
	})

	describe("reset", () => {
		it("should clear all accumulated data", () => {
			const profiler = RenderProfiler.getInstance()
			profiler.configure({ enabled: true, logComponents: false, logStoreUpdates: false })

			profiler.recordRender("TestComponent", 5.0)
			profiler.recordStoreUpdate("TestStore", "set", 1.0)
			profiler.recordFrameTime(10.0)

			let summary = profiler.getSummary()
			expect(summary.totalRenders).toBe(1)

			profiler.reset()

			summary = profiler.getSummary()
			expect(summary.totalRenders).toBe(0)
			expect(Object.keys(summary.storeUpdates)).toHaveLength(0)
			expect(profiler.getFrameStats()).toBeNull()
		})
	})

	describe("stop", () => {
		it("should flush data and stop timers", () => {
			const profiler = RenderProfiler.getInstance()
			profiler.configure({ enabled: true, logComponents: false })

			profiler.recordRender("TestComponent", 5.0)
			profiler.stop()

			// After stop, data should be reset
			const summary = profiler.getSummary()
			expect(summary.totalRenders).toBe(0)
		})
	})
})

describe("isProfilingEnabled", () => {
	beforeEach(() => {
		RenderProfiler.resetInstance()
	})

	afterEach(() => {
		RenderProfiler.resetInstance()
	})

	it("should return false when profiler is not enabled", () => {
		expect(isProfilingEnabled()).toBe(false)
	})

	it("should return true when profiler is enabled", () => {
		RenderProfiler.getInstance().configure({ enabled: true })
		expect(isProfilingEnabled()).toBe(true)
	})
})

describe("getRenderLogPath", () => {
	it("should return path in home directory", () => {
		const logPath = getRenderLogPath()
		expect(logPath).toContain(os.homedir())
		expect(logPath).toContain(".roo")
		expect(logPath).toContain("cli-render.log")
	})
})
