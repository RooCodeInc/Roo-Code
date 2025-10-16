import { describe, it, expect, beforeEach, vi } from "vitest"
import { QdrantClient } from "@qdrant/js-client-rest"
import { QdrantVectorStore } from "../qdrant-client"
import * as gitUtils from "../../../../utils/git"

// Mock dependencies
vi.mock("@qdrant/js-client-rest")
vi.mock("crypto", () => ({
	createHash: vi.fn(() => ({
		update: vi.fn(() => ({
			digest: vi.fn(() => "mockedhash1234567890abcdef"),
		})),
	})),
}))

vi.mock("../../../../utils/git", () => ({
	getCurrentBranch: vi.fn(),
	sanitizeBranchName: vi.fn(),
}))

describe("QdrantVectorStore - Branch Isolation", () => {
	let mockQdrantClientInstance: any
	const mockWorkspacePath = "/test/workspace"
	const mockQdrantUrl = "http://localhost:6333"
	const mockVectorSize = 1536
	const mockApiKey = "test-api-key"

	beforeEach(() => {
		vi.clearAllMocks()
		mockQdrantClientInstance = {
			getCollection: vi.fn(),
			createCollection: vi.fn(),
			deleteCollection: vi.fn(),
			createPayloadIndex: vi.fn(),
			upsert: vi.fn(),
			query: vi.fn(),
			delete: vi.fn(),
		}
		;(QdrantClient as any).mockImplementation(() => mockQdrantClientInstance)
	})

	describe("Branch Isolation Disabled", () => {
		it("should use workspace-only collection name when branch isolation is disabled", async () => {
			const vectorStore = new QdrantVectorStore(
				mockWorkspacePath,
				mockQdrantUrl,
				mockVectorSize,
				mockApiKey,
				false, // branchIsolationEnabled = false
			)

			// Mock collection doesn't exist
			mockQdrantClientInstance.getCollection.mockRejectedValue({
				status: 404,
				message: "Collection not found",
			})

			await vectorStore.initialize()

			// Should create collection with workspace-only name
			expect(mockQdrantClientInstance.createCollection).toHaveBeenCalledWith(
				"ws-mockedhash123456",
				expect.any(Object),
			)
			expect(gitUtils.getCurrentBranch).not.toHaveBeenCalled()
		})

		it("should return null for getCurrentBranch when branch isolation is disabled", () => {
			const vectorStore = new QdrantVectorStore(
				mockWorkspacePath,
				mockQdrantUrl,
				mockVectorSize,
				mockApiKey,
				false,
			)

			expect(vectorStore.getCurrentBranch()).toBeNull()
		})
	})

	describe("Branch Isolation Enabled", () => {
		it("should use branch-specific collection name when on a Git branch", async () => {
			;(gitUtils.getCurrentBranch as any).mockResolvedValue("feature/test-branch")
			;(gitUtils.sanitizeBranchName as any).mockReturnValue("feature-test-branch")

			const vectorStore = new QdrantVectorStore(
				mockWorkspacePath,
				mockQdrantUrl,
				mockVectorSize,
				mockApiKey,
				true, // branchIsolationEnabled = true
			)

			// Mock collection doesn't exist
			mockQdrantClientInstance.getCollection.mockRejectedValue({
				status: 404,
				message: "Collection not found",
			})

			await vectorStore.initialize()

			// Should detect current branch
			expect(gitUtils.getCurrentBranch).toHaveBeenCalledWith(mockWorkspacePath)
			expect(gitUtils.sanitizeBranchName).toHaveBeenCalledWith("feature/test-branch")

			// Should create collection with branch-specific name
			expect(mockQdrantClientInstance.createCollection).toHaveBeenCalledWith(
				"ws-mockedhash123456-br-feature-test-branch",
				expect.any(Object),
			)
		})

		it("should use workspace-only collection name when in detached HEAD state", async () => {
			;(gitUtils.getCurrentBranch as any).mockResolvedValue(null) // Detached HEAD

			const vectorStore = new QdrantVectorStore(
				mockWorkspacePath,
				mockQdrantUrl,
				mockVectorSize,
				mockApiKey,
				true,
			)

			// Mock collection doesn't exist
			mockQdrantClientInstance.getCollection.mockRejectedValue({
				status: 404,
				message: "Collection not found",
			})

			await vectorStore.initialize()

			// Should detect detached HEAD
			expect(gitUtils.getCurrentBranch).toHaveBeenCalledWith(mockWorkspacePath)

			// Should create collection with workspace-only name (no branch suffix)
			expect(mockQdrantClientInstance.createCollection).toHaveBeenCalledWith(
				"ws-mockedhash123456",
				expect.any(Object),
			)
		})

		it("should use workspace-only collection name when not in a Git repository", async () => {
			;(gitUtils.getCurrentBranch as any).mockResolvedValue(null) // Not a Git repo

			const vectorStore = new QdrantVectorStore(
				mockWorkspacePath,
				mockQdrantUrl,
				mockVectorSize,
				mockApiKey,
				true,
			)

			// Mock collection doesn't exist
			mockQdrantClientInstance.getCollection.mockRejectedValue({
				status: 404,
				message: "Collection not found",
			})

			await vectorStore.initialize()

			// Should detect not a Git repo
			expect(gitUtils.getCurrentBranch).toHaveBeenCalledWith(mockWorkspacePath)

			// Should create collection with workspace-only name (no branch suffix)
			expect(mockQdrantClientInstance.createCollection).toHaveBeenCalledWith(
				"ws-mockedhash123456",
				expect.any(Object),
			)
		})

		it("should handle branch names with special characters", async () => {
			;(gitUtils.getCurrentBranch as any).mockResolvedValue("feature/user-auth-2.0")
			;(gitUtils.sanitizeBranchName as any).mockReturnValue("feature-user-auth-2-0")

			const vectorStore = new QdrantVectorStore(
				mockWorkspacePath,
				mockQdrantUrl,
				mockVectorSize,
				mockApiKey,
				true,
			)

			// Mock collection doesn't exist
			mockQdrantClientInstance.getCollection.mockRejectedValue({
				status: 404,
				message: "Collection not found",
			})

			await vectorStore.initialize()

			// Should sanitize branch name
			expect(gitUtils.sanitizeBranchName).toHaveBeenCalledWith("feature/user-auth-2.0")

			// Should create collection with sanitized branch name
			expect(mockQdrantClientInstance.createCollection).toHaveBeenCalledWith(
				"ws-mockedhash123456-br-feature-user-auth-2-0",
				expect.any(Object),
			)
		})

		it("should return the current branch name when branch isolation is enabled", async () => {
			;(gitUtils.getCurrentBranch as any).mockResolvedValue("main")
			;(gitUtils.sanitizeBranchName as any).mockReturnValue("main")

			const vectorStore = new QdrantVectorStore(
				mockWorkspacePath,
				mockQdrantUrl,
				mockVectorSize,
				mockApiKey,
				true,
			)

			// Mock collection doesn't exist
			mockQdrantClientInstance.getCollection.mockRejectedValue({
				status: 404,
				message: "Collection not found",
			})

			await vectorStore.initialize()

			expect(vectorStore.getCurrentBranch()).toBe("main")
		})

		it("should handle very long branch names", async () => {
			const longBranchName = "feature/" + "a".repeat(100)
			const sanitizedLongName = "feature-" + "a".repeat(42) // Truncated to 50 chars

			;(gitUtils.getCurrentBranch as any).mockResolvedValue(longBranchName)
			;(gitUtils.sanitizeBranchName as any).mockReturnValue(sanitizedLongName)

			const vectorStore = new QdrantVectorStore(
				mockWorkspacePath,
				mockQdrantUrl,
				mockVectorSize,
				mockApiKey,
				true,
			)

			// Mock collection doesn't exist
			mockQdrantClientInstance.getCollection.mockRejectedValue({
				status: 404,
				message: "Collection not found",
			})

			await vectorStore.initialize()

			// Should handle long branch name
			expect(gitUtils.sanitizeBranchName).toHaveBeenCalledWith(longBranchName)

			// Should create collection with truncated branch name
			expect(mockQdrantClientInstance.createCollection).toHaveBeenCalledWith(
				`ws-mockedhash123456-br-${sanitizedLongName}`,
				expect.any(Object),
			)
		})
	})

	describe("Branch Switching", () => {
		it("should use different collection names for different branches", async () => {
			// First initialization on main branch
			;(gitUtils.getCurrentBranch as any).mockResolvedValue("main")
			;(gitUtils.sanitizeBranchName as any).mockReturnValue("main")

			const vectorStore1 = new QdrantVectorStore(
				mockWorkspacePath,
				mockQdrantUrl,
				mockVectorSize,
				mockApiKey,
				true,
			)

			mockQdrantClientInstance.getCollection.mockRejectedValue({
				status: 404,
				message: "Collection not found",
			})

			await vectorStore1.initialize()

			expect(mockQdrantClientInstance.createCollection).toHaveBeenCalledWith(
				"ws-mockedhash123456-br-main",
				expect.any(Object),
			)

			// Clear mocks for second initialization
			vi.clearAllMocks()

			// Second initialization on feature branch
			;(gitUtils.getCurrentBranch as any).mockResolvedValue("feature/new-feature")
			;(gitUtils.sanitizeBranchName as any).mockReturnValue("feature-new-feature")

			const vectorStore2 = new QdrantVectorStore(
				mockWorkspacePath,
				mockQdrantUrl,
				mockVectorSize,
				mockApiKey,
				true,
			)

			mockQdrantClientInstance.getCollection.mockRejectedValue({
				status: 404,
				message: "Collection not found",
			})

			await vectorStore2.initialize()

			expect(mockQdrantClientInstance.createCollection).toHaveBeenCalledWith(
				"ws-mockedhash123456-br-feature-new-feature",
				expect.any(Object),
			)
		})
	})
})
