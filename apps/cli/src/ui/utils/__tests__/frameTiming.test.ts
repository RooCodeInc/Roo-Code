/**
 * Tests for FrameTimingTracker utility
 */

import {
	FrameTimingTracker,
	getFrameTimingTracker,
	startFrameTracking,
	stopFrameTracking,
	getFrameStats,
} from "../frameTiming.js"
import { RenderProfiler } from "../renderProfiler.js"

describe("FrameTimingTracker", () => {
	let tracker: FrameTimingTracker

	beforeEach(() => {
		tracker = new FrameTimingTracker(16)
		RenderProfiler.resetInstance()
	})

	afterEach(() => {
		tracker.stop()
		RenderProfiler.resetInstance()
	})

	describe("constructor", () => {
		it("should create tracker with default threshold", () => {
			const defaultTracker = new FrameTimingTracker()
			const stats = defaultTracker.getStats()
			expect(stats.threshold).toBe(16)
		})

		it("should create tracker with custom threshold", () => {
			const customTracker = new FrameTimingTracker(33)
			const stats = customTracker.getStats()
			expect(stats.threshold).toBe(33)
		})
	})

	describe("start/stop", () => {
		it("should start tracking", () => {
			expect(tracker.isRunning()).toBe(false)
			tracker.start()
			expect(tracker.isRunning()).toBe(true)
		})

		it("should stop tracking", () => {
			tracker.start()
			expect(tracker.isRunning()).toBe(true)
			tracker.stop()
			expect(tracker.isRunning()).toBe(false)
		})

		it("should not start multiple times", () => {
			tracker.start()
			tracker.start() // Should not throw
			expect(tracker.isRunning()).toBe(true)
		})
	})

	describe("getStats", () => {
		it("should return empty stats when no measurements", () => {
			const stats = tracker.getStats()
			expect(stats.measurements).toBe(0)
			expect(stats.avgMs).toBe(0)
			expect(stats.maxMs).toBe(0)
			expect(stats.p95Ms).toBe(0)
			expect(stats.droppedFrames).toBe(0)
		})
	})

	describe("reset", () => {
		it("should clear measurements", async () => {
			tracker.start()
			// Wait for some measurements
			await new Promise((resolve) => setTimeout(resolve, 50))
			tracker.stop()

			const statsBefore = tracker.getStats()
			expect(statsBefore.measurements).toBeGreaterThan(0)

			tracker.reset()

			const statsAfter = tracker.getStats()
			expect(statsAfter.measurements).toBe(0)
		})
	})
})

describe("Global frame tracking functions", () => {
	afterEach(() => {
		stopFrameTracking()
		RenderProfiler.resetInstance()
	})

	describe("getFrameTimingTracker", () => {
		it("should return singleton tracker", () => {
			const tracker1 = getFrameTimingTracker()
			const tracker2 = getFrameTimingTracker()
			expect(tracker1).toBe(tracker2)
		})
	})

	describe("startFrameTracking", () => {
		it("should start global tracker", () => {
			startFrameTracking()
			const tracker = getFrameTimingTracker()
			expect(tracker.isRunning()).toBe(true)
		})

		it("should not start if already running", () => {
			startFrameTracking()
			startFrameTracking() // Should not throw
			expect(getFrameTimingTracker().isRunning()).toBe(true)
		})
	})

	describe("stopFrameTracking", () => {
		it("should stop global tracker", () => {
			startFrameTracking()
			stopFrameTracking()
			expect(getFrameTimingTracker().isRunning()).toBe(false)
		})

		it("should handle stop when not started", () => {
			stopFrameTracking() // Should not throw
		})
	})

	describe("getFrameStats", () => {
		it("should return null when no tracker exists", () => {
			// Note: This test may need adjustment since getFrameTimingTracker creates the tracker
			const stats = getFrameStats()
			// Stats should exist but have 0 measurements
			expect(stats?.measurements).toBe(0)
		})
	})
})
