import { aggregateReports } from "../report-aggregator"
import type { AgentState, MergeResult } from "../types"

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
	return {
		taskId: "agent-1",
		providerId: "p-1",
		panelId: "panel-1",
		worktreePath: null,
		worktreeBranch: null,
		mode: "code",
		status: "completed",
		title: "Test Agent",
		completionReport: null,
		tokenUsage: null,
		startedAt: null,
		completedAt: null,
		...overrides,
	}
}

function makeMergeResult(overrides: Partial<MergeResult> = {}): MergeResult {
	return {
		agentTaskId: "agent-1",
		branch: "multi-orch/agent-1",
		success: true,
		conflictsFound: 0,
		conflictsResolved: 0,
		filesChanged: [],
		...overrides,
	}
}

describe("aggregateReports", () => {
	it("should include a header with agent count", () => {
		const report = aggregateReports([makeAgent(), makeAgent({ taskId: "agent-2", title: "Agent 2" })], [])
		expect(report).toContain("# Multi-Orchestration Report")
		expect(report).toContain("**2 agents** executed in parallel.")
	})

	it("should include agent results section", () => {
		const report = aggregateReports([makeAgent({ title: "Build API" })], [])
		expect(report).toContain("## Agent Results")
		expect(report).toContain("Build API")
	})

	it("should show ✅ for completed agents", () => {
		const report = aggregateReports([makeAgent({ status: "completed", title: "Task A" })], [])
		expect(report).toContain("### ✅ Task A (code mode)")
	})

	it("should show ❌ for failed agents", () => {
		const report = aggregateReports([makeAgent({ status: "failed", title: "Task B" })], [])
		expect(report).toContain("### ❌ Task B (code mode)")
	})

	it("should calculate duration when startedAt and completedAt are set", () => {
		const report = aggregateReports(
			[makeAgent({ startedAt: 1000000, completedAt: 1005000 })],
			[],
		)
		expect(report).toContain("**Duration:** 5s")
	})

	it("should show 'unknown' duration when timestamps are missing", () => {
		const report = aggregateReports(
			[makeAgent({ startedAt: null, completedAt: null })],
			[],
		)
		expect(report).toContain("**Duration:** unknown")
	})

	it("should include token usage when present", () => {
		const report = aggregateReports(
			[makeAgent({ tokenUsage: { input: 1500, output: 800 } })],
			[],
		)
		expect(report).toContain("**Tokens:** 1500 in / 800 out")
	})

	it("should not include token usage line when null", () => {
		const report = aggregateReports(
			[makeAgent({ tokenUsage: null })],
			[],
		)
		expect(report).not.toContain("**Tokens:**")
	})

	it("should include completion report when present", () => {
		const report = aggregateReports(
			[makeAgent({ completionReport: "All tests pass." })],
			[],
		)
		expect(report).toContain("**Report:** All tests pass.")
	})

	it("should not include report line when null", () => {
		const report = aggregateReports(
			[makeAgent({ completionReport: null })],
			[],
		)
		expect(report).not.toContain("**Report:**")
	})

	describe("with merge results", () => {
		it("should include merge results section when results present", () => {
			const report = aggregateReports(
				[makeAgent()],
				[makeMergeResult({ branch: "multi-orch/abc123" })],
			)
			expect(report).toContain("## Merge Results")
			expect(report).toContain("Branch: multi-orch/abc123")
		})

		it("should show ✅ for successful merges", () => {
			const report = aggregateReports(
				[makeAgent()],
				[makeMergeResult({ success: true, branch: "b1" })],
			)
			expect(report).toContain("### ✅ Branch: b1")
		})

		it("should show ⚠️ for failed merges", () => {
			const report = aggregateReports(
				[makeAgent()],
				[makeMergeResult({ success: false, branch: "b2" })],
			)
			expect(report).toContain("### ⚠️ Branch: b2")
		})

		it("should include conflict info when conflicts found", () => {
			const report = aggregateReports(
				[makeAgent()],
				[makeMergeResult({ conflictsFound: 3, conflictsResolved: 1 })],
			)
			expect(report).toContain("**Conflicts found:** 3")
			expect(report).toContain("**Conflicts resolved:** 1")
		})

		it("should not include conflict info when no conflicts", () => {
			const report = aggregateReports(
				[makeAgent()],
				[makeMergeResult({ conflictsFound: 0 })],
			)
			expect(report).not.toContain("**Conflicts found:**")
		})

		it("should include files changed count", () => {
			const report = aggregateReports(
				[makeAgent()],
				[makeMergeResult({ filesChanged: ["a.ts", "b.ts", "c.ts"] })],
			)
			expect(report).toContain("**Files changed:** 3")
		})
	})

	describe("without merge results", () => {
		it("should not include merge results section", () => {
			const report = aggregateReports([makeAgent()], [])
			expect(report).not.toContain("## Merge Results")
		})

		it("should not include merges line in summary", () => {
			const report = aggregateReports([makeAgent()], [])
			expect(report).not.toContain("**Merges:**")
		})
	})

	describe("summary section", () => {
		it("should include summary with completed and failed counts", () => {
			const agents = [
				makeAgent({ taskId: "a1", status: "completed" }),
				makeAgent({ taskId: "a2", status: "completed" }),
				makeAgent({ taskId: "a3", status: "failed" }),
			]
			const report = aggregateReports(agents, [])
			expect(report).toContain("## Summary")
			expect(report).toContain("**Agents:** 2 completed, 1 failed")
		})

		it("should include merge summary when merges present", () => {
			const report = aggregateReports(
				[makeAgent()],
				[
					makeMergeResult({ agentTaskId: "m1", success: true }),
					makeMergeResult({ agentTaskId: "m2", success: false }),
					makeMergeResult({ agentTaskId: "m3", success: true }),
				],
			)
			expect(report).toContain("**Merges:** 2 succeeded, 1 had conflicts")
		})

		it("should handle all-success scenario", () => {
			const agents = [
				makeAgent({ taskId: "a1", status: "completed" }),
				makeAgent({ taskId: "a2", status: "completed" }),
			]
			const report = aggregateReports(agents, [])
			expect(report).toContain("**Agents:** 2 completed, 0 failed")
		})

		it("should handle all-failure scenario", () => {
			const agents = [
				makeAgent({ taskId: "a1", status: "failed" }),
				makeAgent({ taskId: "a2", status: "failed" }),
			]
			const report = aggregateReports(agents, [])
			expect(report).toContain("**Agents:** 0 completed, 2 failed")
		})
	})

	it("should handle empty agents array", () => {
		const report = aggregateReports([], [])
		expect(report).toContain("**0 agents** executed in parallel.")
		expect(report).toContain("**Agents:** 0 completed, 0 failed")
	})
})
