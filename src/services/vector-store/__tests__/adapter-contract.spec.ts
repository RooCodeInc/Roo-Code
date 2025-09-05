import { describe, it, expect, beforeEach, vi } from "vitest"
import { QdrantAdapter } from "../adapters/qdrant"
import { QdrantClient } from "@qdrant/js-client-rest"
import { createHash } from "crypto"

// Mocks
vi.mock("@qdrant/js-client-rest")
vi.mock("crypto")
vi.mock("../../../i18n", () => ({
	t: (key: string, params?: any) => {
		if (key === "embeddings:vectorStore.vectorDimensionMismatch" && params?.errorMessage) {
			return `Failed to update vector index for new model. Please try clearing the index and starting again. Details: ${params.errorMessage}`
		}
		if (key === "embeddings:vectorStore.qdrantConnectionFailed" && params?.qdrantUrl && params?.errorMessage) {
			return `Failed to connect to Qdrant vector database. Please ensure Qdrant is running and accessible at ${params.qdrantUrl}. Error: ${params.errorMessage}`
		}
		return key
	},
}))
vi.mock("path", async () => {
	const actual = await vi.importActual<any>("path")
	return { ...actual, sep: "/", posix: actual.posix }
})

const mockQdrantClientInstance = {
	getCollection: vi.fn(),
	createCollection: vi.fn(),
	deleteCollection: vi.fn(),
	createPayloadIndex: vi.fn(),
	upsert: vi.fn(),
	query: vi.fn(),
	delete: vi.fn(),
}

const mockCreateHashInstance = {
	update: vi.fn().mockReturnThis(),
	digest: vi.fn(),
}

describe("Adapter Contract – QdrantAdapter", () => {
	let adapter: QdrantAdapter
	const mockWorkspacePath = "/test/workspace"
	const mockQdrantUrl = "http://mock-qdrant:6333"
	const mockApiKey = "test-api-key"
	const mockVectorSize = 1536
	const mockHashedPath = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"

	beforeEach(() => {
		vi.clearAllMocks()
		;(QdrantClient as any).mockImplementation(() => mockQdrantClientInstance)
		;(createHash as any).mockReturnValue(mockCreateHashInstance)
		mockCreateHashInstance.update.mockReturnValue(mockCreateHashInstance)
		mockCreateHashInstance.digest.mockReturnValue(mockHashedPath)

		adapter = new QdrantAdapter(mockWorkspacePath, mockQdrantUrl, mockApiKey, mockVectorSize)
	})

	it("ensureCollection: creates new collection and indexes when not found", async () => {
		mockQdrantClientInstance.getCollection.mockRejectedValueOnce(new Error("Not Found"))
		mockQdrantClientInstance.createCollection.mockResolvedValueOnce({})

		const created = await adapter.ensureCollection(adapter.collectionName(), mockVectorSize)

		expect(created).toBe(true)
		expect(mockQdrantClientInstance.createCollection).toHaveBeenCalledTimes(1)
		// pathSegments indexes
		expect(mockQdrantClientInstance.createPayloadIndex).toHaveBeenCalled()
	})

	it("ensureCollection: returns false when collection exists with correct dimension", async () => {
		mockQdrantClientInstance.getCollection.mockResolvedValueOnce({
			config: { params: { vectors: { size: mockVectorSize } } },
		})

		const created = await adapter.ensureCollection(adapter.collectionName(), mockVectorSize)
		expect(created).toBe(false)
		expect(mockQdrantClientInstance.createCollection).not.toHaveBeenCalled()
	})

	it("ensureCollection: recreates when dimension mismatch", async () => {
		mockQdrantClientInstance.getCollection.mockResolvedValueOnce({
			config: { params: { vectors: { size: 768 } } },
		})
		mockQdrantClientInstance.deleteCollection.mockResolvedValueOnce({})
		mockQdrantClientInstance.getCollection.mockResolvedValueOnce(null)
		mockQdrantClientInstance.createCollection.mockResolvedValueOnce({})

		const created = await adapter.ensureCollection(adapter.collectionName(), mockVectorSize)
		expect(created).toBe(true)
		expect(mockQdrantClientInstance.deleteCollection).toHaveBeenCalledTimes(1)
		expect(mockQdrantClientInstance.createCollection).toHaveBeenCalledTimes(1)
	})

	it("upsert: injects pathSegments from payload.filePath", async () => {
		mockQdrantClientInstance.upsert.mockResolvedValueOnce({})
		await adapter.upsert([
			{
				id: "1",
				vector: [0.1, 0.2],
				payload: { filePath: "src/a/b.ts", codeChunk: "x", startLine: 1, endLine: 2 },
			},
		])
		const args = mockQdrantClientInstance.upsert.mock.calls[0][1]
		expect(args.points[0].payload.pathSegments).toEqual({ "0": "src", "1": "a", "2": "b.ts" })
	})

	it("search: returns only points with valid payload shape", async () => {
		mockQdrantClientInstance.query.mockResolvedValueOnce({
			points: [
				{
					id: "1",
					score: 0.9,
					payload: { filePath: "f", codeChunk: "c", startLine: 1, endLine: 2 },
				},
				{ id: "2", score: 0.8, payload: { filePath: "f" } }, // invalid, missing keys
			],
		})
		const results = await adapter.search([0.1, 0.2], 10)
		expect(results.length).toBe(1)
		expect(results[0].id).toBe("1")
	})

	it("deleteByFilter and clearAll delegate to Qdrant", async () => {
		mockQdrantClientInstance.delete.mockResolvedValue({})
		await adapter.deleteByFilter?.({ must: [{ key: "pathSegments.0", match: { value: "src" } }] })
		await adapter.clearAll()
		expect(mockQdrantClientInstance.delete).toHaveBeenCalledTimes(2)
		const clearArgs = mockQdrantClientInstance.delete.mock.calls[1][1]
		expect(clearArgs.filter).toEqual({ must: [] })
	})

	it("collectionExists returns boolean", async () => {
		mockQdrantClientInstance.getCollection.mockResolvedValueOnce({ config: {} })
		expect(await adapter.collectionExists()).toBe(true)
		mockQdrantClientInstance.getCollection.mockRejectedValueOnce(new Error("not found"))
		expect(await adapter.collectionExists()).toBe(false)
	})
})
