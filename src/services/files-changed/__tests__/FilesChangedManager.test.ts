import { describe, it, expect, beforeEach } from "vitest"
import { FilesChangedManager } from "../FilesChangedManager"

const mkChange = (overrides: Partial<ReturnType<FilesChangedManager["getChanges"]>["files"][number]> = {}) => ({
	uri: "app/foo.ts",
	type: "edit" as const,
	fromCheckpoint: "base-A",
	toCheckpoint: "HEAD_WORKING",
	linesAdded: 3,
	linesRemoved: 1,
	...overrides,
})

describe("FilesChangedManager", () => {
	let manager: FilesChangedManager

	beforeEach(() => {
		manager = new FilesChangedManager("base-A")
	})

	it("stores file changes via upsert", () => {
		manager.upsertFile(mkChange())
		manager.upsertFile(mkChange({ uri: "app/bar.ts" }))

		const snapshot = manager.getChanges()
		expect(snapshot.baseCheckpoint).toBe("base-A")
		expect(snapshot.files.map((f) => f.uri)).toEqual(["app/foo.ts", "app/bar.ts"])
	})

	it("removes files when accepted", () => {
		manager.upsertFile(mkChange())
		manager.acceptChange("app/foo.ts")
		expect(manager.getChanges().files).toHaveLength(0)
	})

	it("removes files when rejected", () => {
		manager.upsertFile(mkChange())
		manager.rejectChange("app/foo.ts")
		expect(manager.getChanges().files).toHaveLength(0)
	})

	it("clears all files when acceptAll is called", () => {
		manager.upsertFile(mkChange())
		manager.upsertFile(mkChange({ uri: "app/bar.ts" }))
		manager.acceptAll()
		expect(manager.getChanges().files).toHaveLength(0)
	})

	it("resets baseline and clears files when reset is called", () => {
		manager.upsertFile(mkChange())
		manager.reset("commit-123")
		const snapshot = manager.getChanges()
		expect(snapshot.baseCheckpoint).toBe("commit-123")
		expect(snapshot.files).toHaveLength(0)
	})

	it("getLLMOnlyChanges mirrors current changeset", async () => {
		manager.upsertFile(mkChange())
		const filtered = await manager.getLLMOnlyChanges("task-1", {} as any)
		expect(filtered.files.map((f) => f.uri)).toEqual(["app/foo.ts"])
	})
})
