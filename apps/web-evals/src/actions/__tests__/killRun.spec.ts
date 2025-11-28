// npx vitest run src/actions/__tests__/killRun.spec.ts

import { execSync } from "child_process"

// Mock child_process
vi.mock("child_process", () => ({
	execSync: vi.fn(),
	spawn: vi.fn(),
}))

// Mock next/cache
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}))

// Mock redis client
vi.mock("@/lib/server/redis", () => ({
	redisClient: vi.fn().mockResolvedValue({
		del: vi.fn().mockResolvedValue(1),
	}),
}))

// Mock @roo-code/evals
vi.mock("@roo-code/evals", () => ({
	createRun: vi.fn(),
	deleteRun: vi.fn(),
	createTask: vi.fn(),
	exerciseLanguages: [],
	getExercisesForLanguage: vi.fn().mockResolvedValue([]),
}))

// Mock timers to speed up tests
vi.useFakeTimers()

// Import after mocks
import { killRun } from "../runs"

const mockExecSync = execSync as ReturnType<typeof vi.fn>

describe("killRun", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllTimers()
	})

	it("should kill controller first, wait, then kill task containers", async () => {
		const runId = 123

		// Mock sequence:
		// 1. docker kill controller
		// 2. docker ps (list task containers)
		// 3. docker kill task container 1
		// 4. docker kill task container 2
		mockExecSync
			.mockReturnValueOnce("") // docker kill controller
			.mockReturnValueOnce("evals-task-456.0\nevals-task-789.1\n") // docker ps
			.mockReturnValueOnce("") // docker kill evals-task-456.0
			.mockReturnValueOnce("") // docker kill evals-task-789.1

		const resultPromise = killRun(runId)

		// Fast-forward past the 10 second sleep
		await vi.advanceTimersByTimeAsync(10000)

		const result = await resultPromise

		expect(result.success).toBe(true)
		expect(result.killedContainers).toContain("evals-controller-123")
		expect(result.killedContainers).toContain("evals-task-456.0")
		expect(result.killedContainers).toContain("evals-task-789.1")
		expect(result.errors).toHaveLength(0)

		// Verify order: controller killed first, then task listing, then task kills
		expect(mockExecSync).toHaveBeenNthCalledWith(1, "docker kill evals-controller-123", expect.any(Object))
		expect(mockExecSync).toHaveBeenNthCalledWith(
			2,
			'docker ps --format "{{.Names}}" --filter "name=evals-task-"',
			expect.any(Object),
		)
	})

	it("should continue killing runners even if controller is not running", async () => {
		const runId = 456

		mockExecSync
			.mockImplementationOnce(() => {
				throw new Error("No such container")
			}) // controller kill fails
			.mockReturnValueOnce("evals-task-100.0\n") // docker ps
			.mockReturnValueOnce("") // docker kill task

		const resultPromise = killRun(runId)
		await vi.advanceTimersByTimeAsync(10000)
		const result = await resultPromise

		expect(result.success).toBe(true)
		expect(result.killedContainers).toContain("evals-task-100.0")
		// Controller not in list since it failed
		expect(result.killedContainers).not.toContain("evals-controller-456")
	})

	it("should clear Redis state after killing containers", async () => {
		const runId = 789

		const mockDel = vi.fn().mockResolvedValue(1)
		const { redisClient } = await import("@/lib/server/redis")
		vi.mocked(redisClient).mockResolvedValue({ del: mockDel } as never)

		mockExecSync
			.mockReturnValueOnce("") // controller kill
			.mockReturnValueOnce("") // docker ps (no tasks)

		const resultPromise = killRun(runId)
		await vi.advanceTimersByTimeAsync(10000)
		await resultPromise

		expect(mockDel).toHaveBeenCalledWith("heartbeat:789")
		expect(mockDel).toHaveBeenCalledWith("runners:789")
	})

	it("should handle docker ps failure gracefully", async () => {
		const runId = 111

		mockExecSync
			.mockReturnValueOnce("") // controller kill succeeds
			.mockImplementationOnce(() => {
				throw new Error("Docker error")
			}) // docker ps fails

		const resultPromise = killRun(runId)
		await vi.advanceTimersByTimeAsync(10000)
		const result = await resultPromise

		// Should still be successful because controller was killed
		expect(result.success).toBe(true)
		expect(result.killedContainers).toContain("evals-controller-111")
		expect(result.errors).toContain("Failed to list Docker task containers")
	})

	it("should handle individual task kill failures", async () => {
		const runId = 222

		mockExecSync
			.mockReturnValueOnce("") // controller kill
			.mockReturnValueOnce("evals-task-300.0\nevals-task-400.0\n") // docker ps
			.mockImplementationOnce(() => {
				throw new Error("Kill failed")
			}) // first task kill fails
			.mockReturnValueOnce("") // second task kill succeeds

		const resultPromise = killRun(runId)
		await vi.advanceTimersByTimeAsync(10000)
		const result = await resultPromise

		expect(result.success).toBe(true)
		expect(result.killedContainers).toContain("evals-controller-222")
		expect(result.killedContainers).toContain("evals-task-400.0")
		expect(result.errors.length).toBe(1)
		expect(result.errors[0]).toContain("evals-task-300.0")
	})

	it("should return success with no containers when nothing is running", async () => {
		const runId = 333

		mockExecSync
			.mockImplementationOnce(() => {
				throw new Error("No such container")
			}) // controller not running
			.mockReturnValueOnce("") // no task containers

		const resultPromise = killRun(runId)
		await vi.advanceTimersByTimeAsync(10000)
		const result = await resultPromise

		expect(result.success).toBe(true)
		expect(result.killedContainers).toHaveLength(0)
		expect(result.errors).toHaveLength(0)
	})
})
