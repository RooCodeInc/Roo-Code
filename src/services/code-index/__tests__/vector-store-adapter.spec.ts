import { describe, it, expect, beforeEach, vi } from "vitest"
import { CodeIndexVectorStoreAdapter } from "../vector-store-adapter"

vi.mock("../../../utils/path", () => ({ getWorkspacePath: () => "/test/workspace" }))

describe("CodeIndexVectorStoreAdapter", () => {
	let mockAdapter: any
	let store: CodeIndexVectorStoreAdapter

	beforeEach(() => {
		mockAdapter = {
			collectionName: vi.fn().mockReturnValue("ws-abcdef0123456789"),
			ensureCollection: vi.fn().mockResolvedValue(true),
			upsert: vi.fn().mockResolvedValue(undefined),
			search: vi.fn().mockResolvedValue([]),
			deleteByFilter: vi.fn().mockResolvedValue(undefined),
			clearAll: vi.fn().mockResolvedValue(undefined),
			deleteCollection: vi.fn().mockResolvedValue(undefined),
			collectionExists: vi.fn().mockResolvedValue(true),
			capabilities: vi.fn().mockReturnValue({ deleteByFilter: true }),
		}
		store = new CodeIndexVectorStoreAdapter(mockAdapter, 1536)
	})

	it("initialize delegates to adapter via ensureOnce policy and returns created flag", async () => {
		const created = await store.initialize()
		expect(created).toBe(true)
		expect(mockAdapter.ensureCollection).toHaveBeenCalledWith("ws-abcdef0123456789", 1536)
	})

	it("search builds directory prefix filter using pathSegments.*", async () => {
		await store.search([0.1, 0.2], "src/utils")
		const call = mockAdapter.search.mock.calls[0]
		const filter = call[2]
		expect(filter).toEqual({
			must: [
				{ key: "pathSegments.0", match: { value: "src" } },
				{ key: "pathSegments.1", match: { value: "utils" } },
			],
		})
	})

	it("deletePointsByMultipleFilePaths builds OR filter and calls deleteByFilter", async () => {
		mockAdapter.collectionExists.mockResolvedValueOnce(true)
		await store.deletePointsByMultipleFilePaths(["/test/workspace/src/a.ts", "src/b.ts"])
		const filter = mockAdapter.deleteByFilter.mock.calls[0][0]
		expect(filter.should).toBeDefined()
		expect(filter.should.length).toBe(2)
		// First branch should match src/a.ts exactly
		expect(filter.should[0].must).toEqual([
			{ key: "pathSegments.0", match: { value: "src" } },
			{ key: "pathSegments.1", match: { value: "a.ts" } },
		])
	})

	it("deletePointsByMultipleFilePaths is no-op when collection is missing (parity)", async () => {
		mockAdapter.collectionExists.mockResolvedValueOnce(false)
		await store.deletePointsByMultipleFilePaths(["src/a.ts"]) // should not call deleteByFilter
		expect(mockAdapter.deleteByFilter).not.toHaveBeenCalled()
	})
})
