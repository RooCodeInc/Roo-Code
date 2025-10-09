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
			getCollection: vi.fn().mockResolvedValue(null),
			createCollection: vi.fn().mockResolvedValue(true),
			deleteCollection: vi.fn().mockResolvedValue(true),
			upsert: vi.fn().mockResolvedValue({ status: "completed" }),
			search: vi.fn().mockResolvedValue([]),
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
		it("should return current branch when branch isolation is enabled", () => {
			vectorStore = new QdrantVectorStore(
				testWorkspacePath,
				testQdrantUrl,
				testVectorSize,
				undefined,
				true,
				"main",
			)

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
})
