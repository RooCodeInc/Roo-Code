// npx vitest services/code-index/vector-store/__tests__/qdrant-client.branch-isolation.spec.ts

import { QdrantVectorStore } from "../qdrant-client"
import { QdrantClient } from "@qdrant/js-client-rest"

// Mock the Qdrant client
vi.mock("@qdrant/js-client-rest")

// Mock git utilities
vi.mock("../../../../utils/git")

import { getCurrentBranch, sanitizeBranchName } from "../../../../utils/git"

const mockedGetCurrentBranch = vi.mocked(getCurrentBranch)
const mockedSanitizeBranchName = vi.mocked(sanitizeBranchName)

describe("QdrantVectorStore - Branch Isolation", () => {
	let vectorStore: QdrantVectorStore
	let mockQdrantClient: any
	const testWorkspacePath = "/test/workspace"
	const testQdrantUrl = "http://localhost:6333"
	const testVectorSize = 1536

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup mock Qdrant client
		mockQdrantClient = {
			getCollections: vi.fn().mockResolvedValue({ collections: [] }),
			getCollection: vi.fn().mockResolvedValue({ vectors_count: 1 }),
			createCollection: vi.fn().mockResolvedValue(true),
			deleteCollection: vi.fn().mockResolvedValue(true),
			upsert: vi.fn().mockResolvedValue({ status: "completed" }),
			search: vi.fn().mockResolvedValue([]),
			query: vi.fn().mockResolvedValue({ points: [] }),
			delete: vi.fn().mockResolvedValue({ status: "completed" }),
		}

		// Mock QdrantClient constructor
		vi.mocked(QdrantClient).mockImplementation(() => mockQdrantClient)

		// Setup default git mocks
		mockedSanitizeBranchName.mockImplementation((branch: string) => {
			return branch.toLowerCase().replace(/[^a-z0-9_-]/g, "-")
		})
	})

	afterEach(() => {
		if (vectorStore) {
			// Clean up
		}
	})

	describe("constructor with initialBranch", () => {
		it("should accept and cache initial branch to avoid file I/O", () => {
			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				true, // branch isolation enabled
				"main", // initial branch
			)

			// getCurrentBranch should NOT have been called
			expect(mockedGetCurrentBranch).not.toHaveBeenCalled()
		})

		it("should work without initial branch (backward compatibility)", () => {
			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				true, // branch isolation enabled, no initial branch
			)

			// Should not crash
			expect(vectorStore).toBeDefined()
		})

		it("should handle undefined initial branch", () => {
			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				true,
				undefined, // explicitly undefined
			)

			expect(vectorStore).toBeDefined()
		})
	})

	describe("collection naming with branch isolation", () => {
		beforeEach(() => {
			// Clear all mocks before each test in this suite to prevent cache pollution
			vi.clearAllMocks()
			mockedGetCurrentBranch.mockClear()

			// Ensure vectorStore is undefined to force new instance creation
			vectorStore = undefined as any

			// Reset the mock Qdrant client to ensure clean state for each test
			mockQdrantClient = {
				getCollections: vi.fn().mockResolvedValue({ collections: [] }),
				getCollection: vi.fn().mockResolvedValue(null),
				createCollection: vi.fn().mockResolvedValue(true),
				deleteCollection: vi.fn().mockResolvedValue(true),
				upsert: vi.fn().mockResolvedValue({ status: "completed" }),
				search: vi.fn().mockResolvedValue([]),
				query: vi.fn().mockResolvedValue({ points: [] }),
				delete: vi.fn().mockResolvedValue({ status: "completed" }),
			}
			vi.mocked(QdrantClient).mockImplementation(() => mockQdrantClient)
		})

		it("should create branch-specific collection name when branch is provided", async () => {
			mockedGetCurrentBranch.mockResolvedValue("feature-branch")

			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				true,
				"feature-branch",
			)

			// Mock collection doesn't exist
			mockQdrantClient.getCollection.mockResolvedValue(null)

			await vectorStore.initialize()

			// Should create collection with branch suffix
			expect(mockQdrantClient.createCollection).toHaveBeenCalledWith(
				expect.stringMatching(/^ws-[a-f0-9]+-br-feature-branch$/),
				expect.any(Object),
			)
		})

		it("should sanitize branch names in collection names", async () => {
			const unsafeBranch = "feature/my-feature@v1.2.3"
			const sanitized = "feature-my-feature-v1-2-3"

			mockedSanitizeBranchName.mockReturnValue(sanitized)

			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				true,
				unsafeBranch,
			)

			mockQdrantClient.getCollection.mockResolvedValue(null)

			await vectorStore.initialize()

			expect(mockedSanitizeBranchName).toHaveBeenCalledWith(unsafeBranch)
			expect(mockQdrantClient.createCollection).toHaveBeenCalledWith(
				expect.stringMatching(new RegExp(`^ws-[a-f0-9]+-br-${sanitized}$`)),
				expect.any(Object),
			)
		})

		it("should use workspace-only collection when branch isolation disabled", async () => {
			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				false, // branch isolation disabled
			)

			mockQdrantClient.getCollection.mockResolvedValue(null)

			await vectorStore.initialize()

			// Should NOT include branch suffix
			expect(mockQdrantClient.createCollection).toHaveBeenCalledWith(
				expect.stringMatching(/^ws-[a-f0-9]+$/),
				expect.any(Object),
			)

			// Should NOT call getCurrentBranch
			expect(mockedGetCurrentBranch).not.toHaveBeenCalled()
		})

		it("should handle detached HEAD (undefined branch)", async () => {
			// Clear any cached branch from previous tests and reset mock
			mockedGetCurrentBranch.mockClear()
			mockedGetCurrentBranch.mockResolvedValue(undefined as any)

			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				true,
				undefined, // detached HEAD
			)

			mockQdrantClient.getCollection.mockResolvedValue(null)

			await vectorStore.initialize()

			// Should use workspace-only collection (no branch suffix)
			expect(mockQdrantClient.createCollection).toHaveBeenCalledWith(
				expect.stringMatching(/^ws-[a-f0-9]+$/),
				expect.any(Object),
			)
		})
	})

	describe("cache invalidation", () => {
		it("should invalidate branch cache when invalidateBranchCache is called", async () => {
			mockedGetCurrentBranch.mockResolvedValue("main")

			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				true,
				"main",
			)

			mockQdrantClient.getCollection.mockResolvedValue(null)

			// First initialize - should use cached branch
			await vectorStore.initialize()
			expect(mockedGetCurrentBranch).not.toHaveBeenCalled()

			// Invalidate cache
			vectorStore.invalidateBranchCache()

			// Change the branch
			mockedGetCurrentBranch.mockResolvedValue("feature-branch")

			// Second initialize - should read from git
			await vectorStore.initialize()
			expect(mockedGetCurrentBranch).toHaveBeenCalledWith(testWorkspacePath)
		})

		it("should update collection name after cache invalidation", async () => {
			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				true,
				"main",
			)

			mockQdrantClient.getCollection.mockResolvedValue(null)

			await vectorStore.initialize()

			const firstCollectionCall = mockQdrantClient.createCollection.mock.calls[0][0]
			expect(firstCollectionCall).toMatch(/br-main$/)

			// Invalidate and change branch
			vectorStore.invalidateBranchCache()
			mockedGetCurrentBranch.mockResolvedValue("feature-branch")

			await vectorStore.initialize()

			const secondCollectionCall = mockQdrantClient.createCollection.mock.calls[1][0]
			expect(secondCollectionCall).toMatch(/br-feature-branch$/)
			expect(secondCollectionCall).not.toEqual(firstCollectionCall)
		})
	})

	describe("getCurrentBranch method", () => {
		it("should return current branch when branch isolation is enabled", async () => {
			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				true,
				"main",
			)

			// Need to initialize to set currentBranch
			mockQdrantClient.getCollection.mockResolvedValue({ vectors_count: 0 })
			await vectorStore.initialize()

			expect(vectorStore.getCurrentBranch()).toBe("main")
		})

		it("should return null when branch isolation is disabled", () => {
			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				false, // disabled
			)

			expect(vectorStore.getCurrentBranch()).toBeNull()
		})

		it("should return null for detached HEAD when branch isolation enabled", () => {
			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				true,
				undefined, // detached HEAD
			)

			expect(vectorStore.getCurrentBranch()).toBeNull()
		})
	})

	describe("performance optimization", () => {
		it("should not perform file I/O when initial branch is provided", async () => {
			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				true,
				"main",
			)

			mockQdrantClient.getCollection.mockResolvedValue({ vectors_count: 100 })

			await vectorStore.initialize()

			// Should NOT call getCurrentBranch because we provided initial branch
			expect(mockedGetCurrentBranch).not.toHaveBeenCalled()
		})

		it("should fall back to file I/O when initial branch is not provided", async () => {
			mockedGetCurrentBranch.mockResolvedValue("main")

			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				true,
				// no initial branch
			)

			mockQdrantClient.getCollection.mockResolvedValue(null)

			await vectorStore.initialize()

			// Should call getCurrentBranch
			expect(mockedGetCurrentBranch).toHaveBeenCalledWith(testWorkspacePath)
		})
	})

	describe("cross-branch search isolation", () => {
		it("should not return results from other branch collections when searching", async () => {
			// Setup: Create vector store on main branch
			mockedGetCurrentBranch.mockResolvedValue("main")
			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				true,
				"main",
			)

			// Mock collection doesn't exist initially, then exists after creation
			mockQdrantClient.getCollection.mockResolvedValueOnce(null)
			mockQdrantClient.getCollection.mockResolvedValue({ vectors_count: 1 })
			await vectorStore.initialize()

			// Capture the collection name used for main branch
			const mainCollectionCall = mockQdrantClient.createCollection.mock.calls[0]
			const mainCollectionName = mainCollectionCall[0]
			expect(mainCollectionName).toMatch(/^ws-[a-f0-9]+-br-main$/)

			// Index documents on main branch
			const mainDocs = [
				{
					id: "main-doc-1",
					vector: [1, 0, 0],
					payload: { path: "main.ts", content: "main branch code" },
				},
			]
			await vectorStore.upsertPoints(mainDocs)

			// Verify upsert was called with main collection
			expect(mockQdrantClient.upsert).toHaveBeenCalledWith(
				mainCollectionName,
				expect.objectContaining({
					points: expect.arrayContaining([
						expect.objectContaining({
							id: "main-doc-1",
							payload: expect.objectContaining({ path: "main.ts" }),
						}),
					]),
				}),
			)

			// Switch to feature branch
			vi.clearAllMocks()
			vectorStore.invalidateBranchCache()
			mockedGetCurrentBranch.mockResolvedValue("feature-branch")

			// Re-initialize for feature branch - collection doesn't exist, then exists
			mockQdrantClient.getCollection.mockResolvedValueOnce(null)
			mockQdrantClient.getCollection.mockResolvedValue({ vectors_count: 1 })
			await vectorStore.initialize()

			// Capture the collection name used for feature branch
			const featureCollectionCall = mockQdrantClient.createCollection.mock.calls[0]
			const featureCollectionName = featureCollectionCall[0]
			expect(featureCollectionName).toMatch(/^ws-[a-f0-9]+-br-feature-branch$/)

			// Verify different collection names
			expect(featureCollectionName).not.toBe(mainCollectionName)

			// Index different documents on feature branch
			const featureDocs = [
				{
					id: "feature-doc-1",
					vector: [0, 1, 0],
					payload: { path: "feature.ts", content: "feature branch code" },
				},
			]
			await vectorStore.upsertPoints(featureDocs)

			// Verify upsert was called with feature collection
			expect(mockQdrantClient.upsert).toHaveBeenCalledWith(
				featureCollectionName,
				expect.objectContaining({
					points: expect.arrayContaining([
						expect.objectContaining({
							id: "feature-doc-1",
							payload: expect.objectContaining({ path: "feature.ts" }),
						}),
					]),
				}),
			)

			// Mock search results - feature branch should only return feature docs
			mockQdrantClient.query.mockResolvedValue({
				points: [
					{
						id: "feature-doc-1",
						score: 0.95,
						payload: {
							filePath: "feature.ts",
							codeChunk: "feature branch code",
							startLine: 1,
							endLine: 10,
						},
					},
				],
			})

			// Search on feature branch
			const searchResults = await vectorStore.search([0, 1, 0])

			// Verify search was called with feature collection, not main
			expect(mockQdrantClient.query).toHaveBeenCalledWith(
				featureCollectionName,
				expect.objectContaining({
					query: [0, 1, 0],
				}),
			)

			// Verify results are from feature branch only
			expect(searchResults).toHaveLength(1)
			expect(searchResults[0]?.payload?.filePath).toBe("feature.ts")
			expect(searchResults[0]?.payload?.codeChunk).toBe("feature branch code")

			// Verify main branch document is NOT in results
			expect(searchResults).not.toContainEqual(
				expect.objectContaining({
					payload: expect.objectContaining({ filePath: "main.ts" }),
				}),
			)
		})

		it("should maintain separate indexes when switching back to previous branch", async () => {
			// Start on main branch
			mockedGetCurrentBranch.mockResolvedValue("main")
			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				true,
				"main",
			)

			// Collection doesn't exist initially, then exists after creation
			mockQdrantClient.getCollection.mockResolvedValueOnce(null)
			mockQdrantClient.getCollection.mockResolvedValue({ vectors_count: 1 })
			await vectorStore.initialize()
			const mainCollectionName = mockQdrantClient.createCollection.mock.calls[0][0]

			// Index on main
			await vectorStore.upsertPoints([{ id: "main-1", vector: [1, 0, 0], payload: { path: "main.ts" } }])

			// Switch to feature branch
			vi.clearAllMocks()
			vectorStore.invalidateBranchCache()
			mockedGetCurrentBranch.mockResolvedValue("feature")
			// Collection doesn't exist initially, then exists after creation
			mockQdrantClient.getCollection.mockResolvedValueOnce(null)
			mockQdrantClient.getCollection.mockResolvedValue({ vectors_count: 1 })
			await vectorStore.initialize()
			const featureCollectionName = mockQdrantClient.createCollection.mock.calls[0][0]

			// Index on feature
			await vectorStore.upsertPoints([{ id: "feature-1", vector: [0, 1, 0], payload: { path: "feature.ts" } }])

			// Switch back to main
			vi.clearAllMocks()
			vectorStore.invalidateBranchCache()
			mockedGetCurrentBranch.mockResolvedValue("main")

			// Mock that main collection already exists
			mockQdrantClient.getCollection.mockResolvedValue({ vectors_count: 1 })
			await vectorStore.initialize()

			// Mock search returns main branch docs
			mockQdrantClient.query.mockResolvedValue({
				points: [
					{
						id: "main-1",
						score: 0.95,
						payload: {
							filePath: "main.ts",
							codeChunk: "main branch code",
							startLine: 1,
							endLine: 10,
						},
					},
				],
			})

			const results = await vectorStore.search([1, 0, 0])

			// Should search in main collection
			expect(mockQdrantClient.query).toHaveBeenCalledWith(mainCollectionName, expect.any(Object))

			// Should get main branch results
			expect(results[0]?.payload?.filePath).toBe("main.ts")
		})
	})
})
