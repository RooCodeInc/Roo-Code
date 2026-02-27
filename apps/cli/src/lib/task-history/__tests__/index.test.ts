import { readTaskSessionsFromStoragePath } from "@roo-code/core/cli"

import {
	filterSessionsForWorkspace,
	getDefaultCliTaskStoragePath,
	readWorkspaceTaskSessions,
	resolveWorkspaceResumeSessionId,
} from "../index.js"

vi.mock("@roo-code/core/cli", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@roo-code/core/cli")>()
	return {
		...actual,
		readTaskSessionsFromStoragePath: vi.fn(),
	}
})

describe("task history workspace helpers", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("filters sessions to the current workspace and sorts newest first", () => {
		const result = filterSessionsForWorkspace(
			[
				{ id: "a", task: "A", ts: 10, workspace: "/workspace/project" },
				{ id: "b", task: "B", ts: 30, workspace: "/workspace/project/" },
				{ id: "c", task: "C", ts: 20, workspace: "/workspace/other" },
				{ id: "d", task: "D", ts: 40 },
			],
			"/workspace/project",
		)

		expect(result.map((session) => session.id)).toEqual(["b", "a"])
	})

	it("reads from storage path and applies workspace filtering", async () => {
		vi.mocked(readTaskSessionsFromStoragePath).mockResolvedValue([
			{ id: "a", task: "A", ts: 10, workspace: "/workspace/project" },
			{ id: "b", task: "B", ts: 30, workspace: "/workspace/other" },
		])

		const result = await readWorkspaceTaskSessions("/workspace/project", "/custom/storage")

		expect(readTaskSessionsFromStoragePath).toHaveBeenCalledWith("/custom/storage")
		expect(result).toEqual([{ id: "a", task: "A", ts: 10, workspace: "/workspace/project" }])
	})

	it("returns the expected default CLI storage path", () => {
		expect(getDefaultCliTaskStoragePath()).toContain(".vscode-mock")
		expect(getDefaultCliTaskStoragePath()).toContain("global-storage")
	})

	it("resolves explicit session id only when it exists in current workspace sessions", () => {
		const sessions = [
			{ id: "a", task: "A", ts: 10, workspace: "/workspace/project" },
			{ id: "b", task: "B", ts: 20, workspace: "/workspace/project" },
		]

		expect(resolveWorkspaceResumeSessionId(sessions, "a")).toBe("a")
		expect(() => resolveWorkspaceResumeSessionId(sessions, "missing")).toThrow(
			"Session not found in current workspace",
		)
	})

	it("resolves continue to most recent session and errors when no sessions exist", () => {
		const sessions = [
			{ id: "newer", task: "Newer", ts: 30, workspace: "/workspace/project" },
			{ id: "older", task: "Older", ts: 10, workspace: "/workspace/project" },
		]

		expect(resolveWorkspaceResumeSessionId(sessions)).toBe("newer")
		expect(() => resolveWorkspaceResumeSessionId([])).toThrow("No previous tasks found to continue")
	})
})
