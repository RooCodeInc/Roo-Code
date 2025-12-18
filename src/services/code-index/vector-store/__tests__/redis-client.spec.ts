import Redis from "ioredis"
import { createHash } from "crypto"
import { v5 as uuidv5 } from "uuid"

import { RedisVectorStore } from "../redis-client"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE, REDIS_CODE_BLOCK_NAMESPACE } from "../../constants"

// Mocks
vitest.mock("ioredis")
vitest.mock("crypto")
vitest.mock("uuid")
vitest.mock("../../../../i18n", () => ({
	t: (key: string, params?: any) => {
		if (key === "embeddings:vectorStore.redisConnectionFailed" && params?.redisUrl && params?.errorMessage) {
			return `Failed to connect to Redis vector database. Please ensure Redis Stack is running and accessible at ${params.redisUrl}. Error: ${params.errorMessage}`
		}
		return key
	},
}))
vitest.mock("path", async () => {
	const actual = await vitest.importActual("path")
	return {
		...actual,
		sep: "/",
		posix: actual.posix,
	}
})

const mockRedisInstance = {
	connect: vitest.fn(),
	quit: vitest.fn(),
	call: vitest.fn(),
	pipeline: vitest.fn(),
	hset: vitest.fn(),
	hget: vitest.fn(),
	del: vitest.fn(),
	scan: vitest.fn(),
	exists: vitest.fn(),
	on: vitest.fn(),
}

const mockPipeline = {
	hset: vitest.fn().mockReturnThis(),
	exec: vitest.fn(),
}

const mockCreateHashInstance = {
	update: vitest.fn().mockReturnThis(),
	digest: vitest.fn(),
}

describe("RedisVectorStore", () => {
	let vectorStore: RedisVectorStore
	const mockWorkspacePath = "/test/workspace"
	const mockRedisUrl = "redis://mock-redis:6379"
	const mockPassword = "test-password"
	const mockVectorSize = 1536
	const mockHashedPath = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
	const expectedIndexName = `ws-${mockHashedPath.substring(0, 16)}`
	const expectedKeyPrefix = `${expectedIndexName}:`

	beforeEach(() => {
		vitest.clearAllMocks()

		// Mock Redis constructor
		;(Redis as any).mockImplementation(() => mockRedisInstance)

		// Mock crypto.createHash
		;(createHash as any).mockReturnValue(mockCreateHashInstance)
		mockCreateHashInstance.update.mockReturnValue(mockCreateHashInstance)
		mockCreateHashInstance.digest.mockReturnValue(mockHashedPath)

		// Mock uuid
		;(uuidv5 as any).mockReturnValue("mock-metadata-uuid")

		// Mock pipeline
		mockRedisInstance.pipeline.mockReturnValue(mockPipeline)

		// Reset connection state
		mockRedisInstance.connect.mockResolvedValue(undefined)
		mockRedisInstance.quit.mockResolvedValue(undefined)

		vectorStore = new RedisVectorStore(mockWorkspacePath, mockRedisUrl, mockVectorSize, mockPassword)
	})

	describe("constructor", () => {
		it("should correctly initialize Redis client and indexName", () => {
			expect(Redis).toHaveBeenCalledTimes(1)
			expect(Redis).toHaveBeenCalledWith({
				host: "mock-redis",
				port: 6379,
				password: mockPassword,
				db: 0,
				lazyConnect: true,
				retryStrategy: expect.any(Function),
			})
			expect(createHash).toHaveBeenCalledWith("sha256")
			expect(mockCreateHashInstance.update).toHaveBeenCalledWith(mockWorkspacePath)
			expect(mockCreateHashInstance.digest).toHaveBeenCalledWith("hex")
			expect((vectorStore as any).indexName).toBe(expectedIndexName)
			expect((vectorStore as any).keyPrefix).toBe(expectedKeyPrefix)
		})

		it("should handle URL without port", () => {
			vitest.clearAllMocks()
			;(Redis as any).mockImplementation(() => mockRedisInstance)
			;(createHash as any).mockReturnValue(mockCreateHashInstance)
			mockCreateHashInstance.update.mockReturnValue(mockCreateHashInstance)
			mockCreateHashInstance.digest.mockReturnValue(mockHashedPath)

			new RedisVectorStore(mockWorkspacePath, "redis://localhost", mockVectorSize)

			expect(Redis).toHaveBeenCalledWith(
				expect.objectContaining({
					host: "localhost",
					port: 6379,
				}),
			)
		})

		it("should handle URL with password in URL", () => {
			vitest.clearAllMocks()
			;(Redis as any).mockImplementation(() => mockRedisInstance)
			;(createHash as any).mockReturnValue(mockCreateHashInstance)
			mockCreateHashInstance.update.mockReturnValue(mockCreateHashInstance)
			mockCreateHashInstance.digest.mockReturnValue(mockHashedPath)

			new RedisVectorStore(mockWorkspacePath, "redis://:urlpassword@localhost:6379", mockVectorSize)

			expect(Redis).toHaveBeenCalledWith(
				expect.objectContaining({
					host: "localhost",
					port: 6379,
					password: "urlpassword",
				}),
			)
		})

		it("should prefer explicit password over URL password", () => {
			vitest.clearAllMocks()
			;(Redis as any).mockImplementation(() => mockRedisInstance)
			;(createHash as any).mockReturnValue(mockCreateHashInstance)
			mockCreateHashInstance.update.mockReturnValue(mockCreateHashInstance)
			mockCreateHashInstance.digest.mockReturnValue(mockHashedPath)

			new RedisVectorStore(
				mockWorkspacePath,
				"redis://:urlpassword@localhost:6379",
				mockVectorSize,
				"explicitpassword",
			)

			expect(Redis).toHaveBeenCalledWith(
				expect.objectContaining({
					password: "explicitpassword",
				}),
			)
		})

		it("should use custom database number", () => {
			vitest.clearAllMocks()
			;(Redis as any).mockImplementation(() => mockRedisInstance)
			;(createHash as any).mockReturnValue(mockCreateHashInstance)
			mockCreateHashInstance.update.mockReturnValue(mockCreateHashInstance)
			mockCreateHashInstance.digest.mockReturnValue(mockHashedPath)

			new RedisVectorStore(mockWorkspacePath, mockRedisUrl, mockVectorSize, undefined, 5)

			expect(Redis).toHaveBeenCalledWith(
				expect.objectContaining({
					db: 5,
				}),
			)
		})

		it("should handle URL-like format that parses successfully", () => {
			vitest.clearAllMocks()
			;(Redis as any).mockImplementation(() => mockRedisInstance)
			;(createHash as any).mockReturnValue(mockCreateHashInstance)
			mockCreateHashInstance.update.mockReturnValue(mockCreateHashInstance)
			mockCreateHashInstance.digest.mockReturnValue(mockHashedPath)

			// Note: "localhost:6379" is parsed by new URL() - "localhost" becomes protocol
			// This results in an empty hostname, so it's not a great user experience but
			// demonstrates the URL parsing behavior
			new RedisVectorStore(mockWorkspacePath, "localhost:6379", mockVectorSize)

			// The URL is parsed but produces empty hostname since "localhost" is treated as protocol
			expect(Redis).toHaveBeenCalledWith(
				expect.objectContaining({
					port: 6379, // Port defaults to 6379 since parsed port is NaN
				}),
			)
		})
	})

	describe("initialize", () => {
		it("should create a new index if none exists and return true", async () => {
			// Mock FT.INFO to throw error (index doesn't exist)
			mockRedisInstance.call.mockImplementation((cmd: string) => {
				if (cmd === "FT.INFO") {
					const error = new Error("Unknown index name")
					return Promise.reject(error)
				}
				if (cmd === "FT.CREATE") {
					return Promise.resolve("OK")
				}
				return Promise.resolve()
			})

			const result = await vectorStore.initialize()

			expect(result).toBe(true)
			expect(mockRedisInstance.call).toHaveBeenCalledWith("FT.INFO", expectedIndexName)
			expect(mockRedisInstance.call).toHaveBeenCalledWith(
				"FT.CREATE",
				expectedIndexName,
				"ON",
				"HASH",
				"PREFIX",
				"1",
				expectedKeyPrefix,
				"SCHEMA",
				"vector",
				"VECTOR",
				"HNSW",
				"6",
				"TYPE",
				"FLOAT32",
				"DIM",
				mockVectorSize.toString(),
				"DISTANCE_METRIC",
				"COSINE",
				"filePath",
				"TAG",
				"SEPARATOR",
				"|",
				"codeChunk",
				"TEXT",
				"NOSTEM",
				"startLine",
				"NUMERIC",
				"endLine",
				"NUMERIC",
				"type",
				"TAG",
				"pathSegment0",
				"TAG",
				"pathSegment1",
				"TAG",
				"pathSegment2",
				"TAG",
				"pathSegment3",
				"TAG",
				"pathSegment4",
				"TAG",
			)
		})

		it("should not recreate index if exists with matching vector size", async () => {
			// Mock FT.INFO to return index info with matching dimension
			mockRedisInstance.call.mockImplementation((cmd: string) => {
				if (cmd === "FT.INFO") {
					return Promise.resolve([
						"attributes",
						[["identifier", "vector", "type", "VECTOR", "DIM", mockVectorSize.toString()]],
					])
				}
				return Promise.resolve()
			})

			const result = await vectorStore.initialize()

			expect(result).toBe(false)
			expect(mockRedisInstance.call).toHaveBeenCalledWith("FT.INFO", expectedIndexName)
			expect(mockRedisInstance.call).not.toHaveBeenCalledWith(
				expect.stringContaining("FT.CREATE"),
				expect.anything(),
			)
		})

		it("should recreate index if dimension mismatch", async () => {
			const differentDimension = 768
			let ftInfoCallCount = 0

			mockRedisInstance.call.mockImplementation((cmd: string) => {
				if (cmd === "FT.INFO") {
					ftInfoCallCount++
					if (ftInfoCallCount === 1) {
						// First call returns existing index with different dimension
						return Promise.resolve([
							"attributes",
							[["identifier", "vector", "type", "VECTOR", "DIM", differentDimension.toString()]],
						])
					}
					// Subsequent calls (after drop or during deleteCollection) - index doesn't exist
					return Promise.reject(new Error("Unknown index name"))
				}
				if (cmd === "FT.DROPINDEX") {
					return Promise.resolve("OK")
				}
				if (cmd === "FT.CREATE") {
					return Promise.resolve("OK")
				}
				return Promise.resolve()
			})

			mockRedisInstance.scan.mockResolvedValue(["0", []])

			vitest.spyOn(console, "warn").mockImplementation(() => {})
			vitest.spyOn(console, "log").mockImplementation(() => {})

			const result = await vectorStore.initialize()

			expect(result).toBe(true)
			// Verify FT.CREATE was called with correct vector dimension
			const ftCreateCalls = mockRedisInstance.call.mock.calls.filter((call) => call[0] === "FT.CREATE")
			expect(ftCreateCalls.length).toBe(1)
			expect(ftCreateCalls[0]).toContain(mockVectorSize.toString())
			;(console.warn as any).mockRestore()
			;(console.log as any).mockRestore()
		})

		it("should throw error on connection failure", async () => {
			mockRedisInstance.connect.mockRejectedValue(new Error("Connection refused"))
			mockRedisInstance.call.mockRejectedValue(new Error("Connection refused"))
			vitest.spyOn(console, "error").mockImplementation(() => {})

			await expect(vectorStore.initialize()).rejects.toThrow(
				/Failed to connect to Redis vector database.*Connection refused/,
			)
			;(console.error as any).mockRestore()
		})
	})

	describe("upsertPoints", () => {
		beforeEach(() => {
			// Ensure connection succeeds
			mockRedisInstance.call.mockResolvedValue("OK")
		})

		it("should correctly upsert points with pipeline", async () => {
			const mockPoints = [
				{
					id: "test-id-1",
					vector: [0.1, 0.2, 0.3],
					payload: {
						filePath: "src/components/Button.tsx",
						codeChunk: "export const Button = () => {}",
						startLine: 1,
						endLine: 3,
					},
				},
				{
					id: "test-id-2",
					vector: [0.4, 0.5, 0.6],
					payload: {
						filePath: "src/utils/helpers.ts",
						codeChunk: "export function helper() {}",
						startLine: 5,
						endLine: 7,
					},
				},
			]

			mockPipeline.exec.mockResolvedValue([])

			await vectorStore.upsertPoints(mockPoints)

			expect(mockRedisInstance.pipeline).toHaveBeenCalledTimes(1)
			expect(mockPipeline.hset).toHaveBeenCalledTimes(2)

			// Verify first point
			expect(mockPipeline.hset).toHaveBeenCalledWith(
				`${expectedKeyPrefix}test-id-1`,
				expect.objectContaining({
					filePath: "src/components/Button.tsx",
					codeChunk: "export const Button = () => {}",
					startLine: "1",
					endLine: "3",
					type: "code",
					pathSegment0: "src",
					pathSegment1: "components",
					pathSegment2: "Button.tsx",
				}),
			)

			// Verify second point
			expect(mockPipeline.hset).toHaveBeenCalledWith(
				`${expectedKeyPrefix}test-id-2`,
				expect.objectContaining({
					filePath: "src/utils/helpers.ts",
					pathSegment0: "src",
					pathSegment1: "utils",
					pathSegment2: "helpers.ts",
				}),
			)

			expect(mockPipeline.exec).toHaveBeenCalledTimes(1)
		})

		it("should handle empty points array", async () => {
			await vectorStore.upsertPoints([])

			expect(mockRedisInstance.pipeline).not.toHaveBeenCalled()
		})

		it("should handle points without payload", async () => {
			const mockPoints = [
				{
					id: "test-id-1",
					vector: [0.1, 0.2, 0.3],
					payload: undefined as any,
				},
			]

			mockPipeline.exec.mockResolvedValue([])

			await vectorStore.upsertPoints(mockPoints)

			expect(mockPipeline.hset).toHaveBeenCalledWith(
				`${expectedKeyPrefix}test-id-1`,
				expect.objectContaining({
					filePath: "",
					codeChunk: "",
					type: "code",
				}),
			)
		})

		it("should throw error on upsert failure", async () => {
			const mockPoints = [
				{
					id: "test-id-1",
					vector: [0.1, 0.2, 0.3],
					payload: { filePath: "test.ts", codeChunk: "code", startLine: 1, endLine: 1 },
				},
			]

			const upsertError = new Error("Pipeline failed")
			mockPipeline.exec.mockRejectedValue(upsertError)
			vitest.spyOn(console, "error").mockImplementation(() => {})

			await expect(vectorStore.upsertPoints(mockPoints)).rejects.toThrow(upsertError)

			expect(console.error).toHaveBeenCalledWith("[RedisVectorStore] Failed to upsert points:", upsertError)
			;(console.error as any).mockRestore()
		})
	})

	describe("search", () => {
		beforeEach(() => {
			mockRedisInstance.call.mockResolvedValue("OK")
		})

		it("should correctly execute search and transform results", async () => {
			const queryVector = [0.1, 0.2, 0.3]

			// Mock FT.SEARCH response
			// Redis returns: [count, key1, [field1, value1, ...], key2, [field2, value2, ...], ...]
			mockRedisInstance.call.mockImplementation((cmd: string) => {
				if (cmd === "FT.SEARCH") {
					return Promise.resolve([
						2, // count
						`${expectedKeyPrefix}test-id-1`,
						[
							"filePath",
							"src/test.ts",
							"codeChunk",
							"test code",
							"startLine",
							"1",
							"endLine",
							"5",
							"__score",
							"0.3",
						], // cosine distance 0.3 -> similarity 0.85
						`${expectedKeyPrefix}test-id-2`,
						[
							"filePath",
							"src/utils.ts",
							"codeChunk",
							"utility code",
							"startLine",
							"10",
							"endLine",
							"15",
							"__score",
							"0.5",
						], // cosine distance 0.5 -> similarity 0.75
					])
				}
				return Promise.resolve()
			})

			const results = await vectorStore.search(queryVector)

			expect(mockRedisInstance.call).toHaveBeenCalledWith(
				"FT.SEARCH",
				expectedIndexName,
				expect.stringContaining("=>[KNN"),
				"PARAMS",
				"2",
				"BLOB",
				expect.any(Buffer),
				"SORTBY",
				"__score",
				"DIALECT",
				"2",
				"RETURN",
				"6",
				"filePath",
				"codeChunk",
				"startLine",
				"endLine",
				"__score",
				"type",
			)

			expect(results).toHaveLength(2)
			expect(results[0]).toEqual({
				id: "test-id-1",
				score: 0.85,
				payload: {
					filePath: "src/test.ts",
					codeChunk: "test code",
					startLine: 1,
					endLine: 5,
				},
			})
			expect(results[1]).toEqual({
				id: "test-id-2",
				score: 0.75,
				payload: {
					filePath: "src/utils.ts",
					codeChunk: "utility code",
					startLine: 10,
					endLine: 15,
				},
			})
		})

		it("should apply directory prefix filter", async () => {
			const queryVector = [0.1, 0.2, 0.3]
			const directoryPrefix = "src/components"

			mockRedisInstance.call.mockResolvedValue([0]) // No results

			await vectorStore.search(queryVector, directoryPrefix)

			// Verify the query contains path segment filters
			const searchCall = mockRedisInstance.call.mock.calls.find((call) => call[0] === "FT.SEARCH")
			expect(searchCall).toBeDefined()
			const query = searchCall?.[2] as string
			expect(query).toContain("@pathSegment0:{src}")
			expect(query).toContain("@pathSegment1:{components}")
		})

		it("should not apply filter for current directory '.'", async () => {
			const queryVector = [0.1, 0.2, 0.3]

			mockRedisInstance.call.mockResolvedValue([0])

			await vectorStore.search(queryVector, ".")

			const callArgs = mockRedisInstance.call.mock.calls.find((call) => call[0] === "FT.SEARCH")
			expect(callArgs?.[2]).not.toContain("@pathSegment0")
		})

		it("should use custom minScore when provided", async () => {
			const queryVector = [0.1, 0.2, 0.3]
			const customMinScore = 0.9

			// Return result with score below threshold
			mockRedisInstance.call.mockResolvedValue([
				1,
				`${expectedKeyPrefix}test-id-1`,
				[
					"filePath",
					"src/test.ts",
					"codeChunk",
					"test code",
					"startLine",
					"1",
					"endLine",
					"5",
					"__score",
					"0.3", // 0.85 similarity
				],
			])

			const results = await vectorStore.search(queryVector, undefined, customMinScore)

			// Result should be filtered out because 0.85 < 0.9
			expect(results).toHaveLength(0)
		})

		it("should use custom maxResults when provided", async () => {
			const queryVector = [0.1, 0.2, 0.3]
			const customMaxResults = 5

			mockRedisInstance.call.mockResolvedValue([0])

			await vectorStore.search(queryVector, undefined, undefined, customMaxResults)

			const callArgs = mockRedisInstance.call.mock.calls.find((call) => call[0] === "FT.SEARCH")
			expect(callArgs?.[2]).toContain("KNN 5")
		})

		it("should filter out results with invalid payloads", async () => {
			const queryVector = [0.1, 0.2, 0.3]

			mockRedisInstance.call.mockResolvedValue([
				2,
				`${expectedKeyPrefix}valid`,
				[
					"filePath",
					"src/test.ts",
					"codeChunk",
					"test code",
					"startLine",
					"1",
					"endLine",
					"5",
					"__score",
					"0.3",
				],
				`${expectedKeyPrefix}invalid`,
				["filePath", "", "codeChunk", "", "startLine", "1", "endLine", "5", "__score", "0.3"], // Missing required fields
			])

			const results = await vectorStore.search(queryVector)

			expect(results).toHaveLength(1)
			expect(results[0].id).toBe("valid")
		})

		it("should filter out metadata type results", async () => {
			const queryVector = [0.1, 0.2, 0.3]

			mockRedisInstance.call.mockResolvedValue([
				2,
				`${expectedKeyPrefix}valid`,
				[
					"filePath",
					"src/test.ts",
					"codeChunk",
					"test code",
					"startLine",
					"1",
					"endLine",
					"5",
					"__score",
					"0.3",
				],
				`${expectedKeyPrefix}metadata`,
				[
					"filePath",
					"",
					"codeChunk",
					"",
					"startLine",
					"0",
					"endLine",
					"0",
					"__score",
					"0.3",
					"type",
					"metadata",
				],
			])

			const results = await vectorStore.search(queryVector)

			expect(results).toHaveLength(1)
			expect(results[0].id).toBe("valid")
		})

		it("should handle empty results", async () => {
			const queryVector = [0.1, 0.2, 0.3]

			mockRedisInstance.call.mockResolvedValue([0])

			const results = await vectorStore.search(queryVector)

			expect(results).toEqual([])
		})

		it("should throw error on search failure", async () => {
			const queryVector = [0.1, 0.2, 0.3]
			const searchError = new Error("Search failed")
			mockRedisInstance.call.mockRejectedValue(searchError)
			vitest.spyOn(console, "error").mockImplementation(() => {})

			await expect(vectorStore.search(queryVector)).rejects.toThrow(searchError)

			expect(console.error).toHaveBeenCalledWith("[RedisVectorStore] Failed to search points:", searchError)
			;(console.error as any).mockRestore()
		})
	})

	describe("deletePointsByFilePath", () => {
		beforeEach(() => {
			mockRedisInstance.call.mockResolvedValue("OK")
		})

		it("should delete points by file path", async () => {
			// Mock FT.INFO to indicate index exists
			mockRedisInstance.call.mockImplementation((cmd: string) => {
				if (cmd === "FT.INFO") {
					return Promise.resolve(["index_name", expectedIndexName])
				}
				if (cmd === "FT.SEARCH") {
					return Promise.resolve([2, `${expectedKeyPrefix}id1`, `${expectedKeyPrefix}id2`])
				}
				return Promise.resolve()
			})

			mockRedisInstance.del.mockResolvedValue(2)

			await vectorStore.deletePointsByFilePath("src/test.ts")

			expect(mockRedisInstance.del).toHaveBeenCalledWith(`${expectedKeyPrefix}id1`, `${expectedKeyPrefix}id2`)
		})

		it("should skip deletion if index does not exist", async () => {
			mockRedisInstance.call.mockImplementation((cmd: string) => {
				if (cmd === "FT.INFO") {
					return Promise.reject(new Error("Unknown index name"))
				}
				return Promise.resolve()
			})

			vitest.spyOn(console, "warn").mockImplementation(() => {})

			await vectorStore.deletePointsByFilePath("src/test.ts")

			expect(mockRedisInstance.del).not.toHaveBeenCalled()
			;(console.warn as any).mockRestore()
		})
	})

	describe("clearCollection", () => {
		it("should scan and delete all keys with prefix", async () => {
			mockRedisInstance.scan
				.mockResolvedValueOnce(["100", [`${expectedKeyPrefix}id1`, `${expectedKeyPrefix}id2`]])
				.mockResolvedValueOnce(["0", [`${expectedKeyPrefix}id3`]])

			mockRedisInstance.del.mockResolvedValue(1)

			vitest.spyOn(console, "log").mockImplementation(() => {})

			await vectorStore.clearCollection()

			expect(mockRedisInstance.scan).toHaveBeenCalledTimes(2)
			expect(mockRedisInstance.del).toHaveBeenCalledTimes(2)
			expect(mockRedisInstance.del).toHaveBeenCalledWith(`${expectedKeyPrefix}id1`, `${expectedKeyPrefix}id2`)
			expect(mockRedisInstance.del).toHaveBeenCalledWith(`${expectedKeyPrefix}id3`)
			;(console.log as any).mockRestore()
		})

		it("should throw error on clear failure", async () => {
			const clearError = new Error("Clear failed")
			mockRedisInstance.scan.mockRejectedValue(clearError)
			vitest.spyOn(console, "error").mockImplementation(() => {})

			await expect(vectorStore.clearCollection()).rejects.toThrow(clearError)
			;(console.error as any).mockRestore()
		})
	})

	describe("deleteCollection", () => {
		it("should clear data and drop index", async () => {
			mockRedisInstance.scan.mockResolvedValue(["0", []])
			mockRedisInstance.call.mockImplementation((cmd: string) => {
				if (cmd === "FT.INFO") {
					return Promise.resolve(["index_name", expectedIndexName])
				}
				if (cmd === "FT.DROPINDEX") {
					return Promise.resolve("OK")
				}
				return Promise.resolve()
			})

			vitest.spyOn(console, "log").mockImplementation(() => {})

			await vectorStore.deleteCollection()

			expect(mockRedisInstance.call).toHaveBeenCalledWith("FT.DROPINDEX", expectedIndexName)
			;(console.log as any).mockRestore()
		})

		it("should not drop index if it does not exist", async () => {
			mockRedisInstance.scan.mockResolvedValue(["0", []])
			mockRedisInstance.call.mockImplementation((cmd: string) => {
				if (cmd === "FT.INFO") {
					return Promise.reject(new Error("Unknown index name"))
				}
				return Promise.resolve()
			})

			vitest.spyOn(console, "log").mockImplementation(() => {})

			await vectorStore.deleteCollection()

			expect(mockRedisInstance.call).not.toHaveBeenCalledWith("FT.DROPINDEX", expect.anything())
			;(console.log as any).mockRestore()
		})
	})

	describe("collectionExists", () => {
		it("should return true when index exists", async () => {
			mockRedisInstance.call.mockResolvedValue(["index_name", expectedIndexName])

			const result = await vectorStore.collectionExists()

			expect(result).toBe(true)
		})

		it("should return false when index does not exist", async () => {
			mockRedisInstance.call.mockRejectedValue(new Error("Unknown index name"))

			const result = await vectorStore.collectionExists()

			expect(result).toBe(false)
		})
	})

	describe("hasIndexedData", () => {
		it("should return true when indexing complete marker exists", async () => {
			mockRedisInstance.call.mockResolvedValue(["index_name", expectedIndexName]) // FT.INFO
			mockRedisInstance.exists.mockResolvedValue(1)
			mockRedisInstance.hget.mockResolvedValue("true")

			const result = await vectorStore.hasIndexedData()

			expect(result).toBe(true)
			expect(mockRedisInstance.hget).toHaveBeenCalledWith(
				expect.stringContaining(expectedKeyPrefix),
				"indexing_complete",
			)
		})

		it("should return false when indexing is not complete", async () => {
			mockRedisInstance.call.mockResolvedValue(["index_name", expectedIndexName])
			mockRedisInstance.exists.mockResolvedValue(1)
			mockRedisInstance.hget.mockResolvedValue("false")

			const result = await vectorStore.hasIndexedData()

			expect(result).toBe(false)
		})

		it("should use backward compatibility when no metadata marker exists", async () => {
			mockRedisInstance.call.mockImplementation((cmd: string) => {
				if (cmd === "FT.INFO") {
					return Promise.resolve(["index_name", expectedIndexName, "num_docs", "100"])
				}
				return Promise.resolve()
			})
			mockRedisInstance.exists.mockResolvedValue(0)

			vitest.spyOn(console, "log").mockImplementation(() => {})

			const result = await vectorStore.hasIndexedData()

			expect(result).toBe(true)
			;(console.log as any).mockRestore()
		})

		it("should return false when index does not exist", async () => {
			mockRedisInstance.call.mockRejectedValue(new Error("Unknown index name"))

			const result = await vectorStore.hasIndexedData()

			expect(result).toBe(false)
		})
	})

	describe("markIndexingComplete", () => {
		it("should store metadata with indexing_complete=true", async () => {
			mockRedisInstance.hset.mockResolvedValue(1)

			vitest.spyOn(console, "log").mockImplementation(() => {})

			await vectorStore.markIndexingComplete()

			expect(mockRedisInstance.hset).toHaveBeenCalledWith(
				expect.stringContaining(expectedKeyPrefix),
				expect.objectContaining({
					type: "metadata",
					indexing_complete: "true",
					completed_at: expect.any(String),
				}),
			)
			;(console.log as any).mockRestore()
		})
	})

	describe("markIndexingIncomplete", () => {
		it("should store metadata with indexing_complete=false", async () => {
			mockRedisInstance.hset.mockResolvedValue(1)

			vitest.spyOn(console, "log").mockImplementation(() => {})

			await vectorStore.markIndexingIncomplete()

			expect(mockRedisInstance.hset).toHaveBeenCalledWith(
				expect.stringContaining(expectedKeyPrefix),
				expect.objectContaining({
					type: "metadata",
					indexing_complete: "false",
					started_at: expect.any(String),
				}),
			)
			;(console.log as any).mockRestore()
		})
	})

	describe("disconnect", () => {
		it("should quit Redis client when connected", async () => {
			// Simulate connected state by calling a method that connects
			mockRedisInstance.call.mockResolvedValue(["index_name", expectedIndexName])
			await vectorStore.collectionExists()

			await vectorStore.disconnect()

			expect(mockRedisInstance.quit).toHaveBeenCalled()
		})

		it("should not quit if not connected", async () => {
			await vectorStore.disconnect()

			expect(mockRedisInstance.quit).not.toHaveBeenCalled()
		})
	})

	describe("cosine distance to similarity conversion", () => {
		it("should correctly convert cosine distance 0 to similarity 1", async () => {
			const queryVector = [0.1, 0.2, 0.3]

			mockRedisInstance.call.mockResolvedValue([
				1,
				`${expectedKeyPrefix}test-id`,
				[
					"filePath",
					"src/test.ts",
					"codeChunk",
					"test code",
					"startLine",
					"1",
					"endLine",
					"5",
					"__score",
					"0", // distance 0 = identical vectors
				],
			])

			const results = await vectorStore.search(queryVector)

			expect(results[0].score).toBe(1)
		})

		it("should correctly convert cosine distance 2 to similarity 0", async () => {
			const queryVector = [0.1, 0.2, 0.3]

			mockRedisInstance.call.mockResolvedValue([
				1,
				`${expectedKeyPrefix}test-id`,
				[
					"filePath",
					"src/test.ts",
					"codeChunk",
					"test code",
					"startLine",
					"1",
					"endLine",
					"5",
					"__score",
					"2", // distance 2 = opposite vectors
				],
			])

			const results = await vectorStore.search(queryVector, undefined, 0) // minScore 0 to not filter

			expect(results[0].score).toBe(0)
		})
	})
})
