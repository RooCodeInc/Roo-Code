import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import {
	getActiveIntentsPath,
	readActiveIntents,
	findIntentById,
	getCachedIntent,
	clearIntentCache,
} from "../yamlLoader"

vi.mock("fs/promises", () => ({
	readFile: vi.fn(),
}))

const mockReadFile = vi.mocked(fs.readFile)

const VALID_YAML = `
active_intents:
  - id: INT-001
    name: Add dark mode
    status: IN_PROGRESS
    owned_scope: ["src/**"]
    constraints: []
    acceptance_criteria: []
  - id: INT-002
    name: Fix login bug
    status: PENDING
    owned_scope: ["app/**"]
    constraints: []
    acceptance_criteria: []
`.trim()

describe("yamlLoader (caching)", () => {
	beforeEach(() => {
		clearIntentCache()
		vi.clearAllMocks()
	})

	describe("getActiveIntentsPath", () => {
		it("returns path under .orchestration/active_intents.yaml", () => {
			const root = path.resolve("/workspace")
			expect(getActiveIntentsPath(root)).toBe(path.join(root, ".orchestration", "active_intents.yaml"))
		})
	})

	describe("readActiveIntents", () => {
		it("returns parsed intents when file content is valid", async () => {
			mockReadFile.mockResolvedValueOnce(VALID_YAML)
			const root = "/ws"
			const result = await readActiveIntents(root)
			expect(result.active_intents).toHaveLength(2)
			expect(result.active_intents[0].id).toBe("INT-001")
			expect(result.active_intents[1].id).toBe("INT-002")
			expect(mockReadFile).toHaveBeenCalledWith(path.join(root, ".orchestration", "active_intents.yaml"), "utf-8")
		})

		it("returns empty array when file read fails", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			mockReadFile.mockRejectedValueOnce(new Error("ENOENT"))
			const result = await readActiveIntents("/ws")
			expect(result).toEqual({ active_intents: [] })
			consoleSpy.mockRestore()
		})

		it("returns empty array when YAML has no active_intents array", async () => {
			mockReadFile.mockResolvedValueOnce("other: value")
			const result = await readActiveIntents("/ws")
			expect(result).toEqual({ active_intents: [] })
		})
	})

	describe("findIntentById", () => {
		it("returns intent when found and populates cache", async () => {
			mockReadFile.mockResolvedValueOnce(VALID_YAML)
			const root = "/workspace"
			const intent = await findIntentById(root, "INT-001")
			expect(intent).not.toBeNull()
			expect(intent?.id).toBe("INT-001")
			expect(intent?.name).toBe("Add dark mode")
			expect(mockReadFile).toHaveBeenCalledTimes(1)
		})

		it("returns null when intent ID not in file", async () => {
			mockReadFile.mockResolvedValueOnce(VALID_YAML)
			const intent = await findIntentById("/ws", "INT-999")
			expect(intent).toBeNull()
		})

		it("uses cache on second call (same workspace, within TTL)", async () => {
			mockReadFile.mockResolvedValue(VALID_YAML)
			const root = "/ws"
			const first = await findIntentById(root, "INT-001")
			const second = await findIntentById(root, "INT-001")
			expect(first?.id).toBe("INT-001")
			expect(second?.id).toBe("INT-001")
			expect(mockReadFile).toHaveBeenCalledTimes(1)
		})

		it("reloads when workspace root differs (different file path)", async () => {
			mockReadFile.mockResolvedValueOnce(VALID_YAML).mockResolvedValueOnce(VALID_YAML)
			await findIntentById("/ws1", "INT-001")
			await findIntentById("/ws2", "INT-001")
			expect(mockReadFile).toHaveBeenCalledTimes(2)
		})
	})

	describe("getCachedIntent", () => {
		it("returns null when cache is empty", () => {
			expect(getCachedIntent("INT-001")).toBeNull()
		})

		it("returns intent after findIntentById has populated cache", async () => {
			mockReadFile.mockResolvedValueOnce(VALID_YAML)
			await findIntentById("/ws", "INT-002")
			expect(getCachedIntent("INT-002")).not.toBeNull()
			expect(getCachedIntent("INT-002")?.name).toBe("Fix login bug")
			expect(getCachedIntent("INT-999")).toBeNull()
		})
	})

	describe("clearIntentCache", () => {
		it("clears cache so getCachedIntent returns null and next findIntentById reloads", async () => {
			mockReadFile.mockResolvedValue(VALID_YAML)
			await findIntentById("/ws", "INT-001")
			expect(getCachedIntent("INT-001")).not.toBeNull()
			clearIntentCache()
			expect(getCachedIntent("INT-001")).toBeNull()
			await findIntentById("/ws", "INT-001")
			expect(mockReadFile).toHaveBeenCalledTimes(2)
		})
	})
})
