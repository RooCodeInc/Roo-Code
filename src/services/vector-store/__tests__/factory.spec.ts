import { describe, it, expect, vi, beforeEach } from "vitest"
import { VectorStoreFactory } from "../factory"
import { UnsupportedProviderError } from "../errors"
import { createHash } from "crypto"

vi.mock("@qdrant/js-client-rest", () => ({ QdrantClient: vi.fn(() => ({})) }))
vi.mock("crypto")

describe("VectorStoreFactory", () => {
	const mockCreateHashInstance = {
		update: vi.fn().mockReturnThis(),
		digest: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
		;(createHash as any).mockReturnValue(mockCreateHashInstance)
		mockCreateHashInstance.update.mockReturnValue(mockCreateHashInstance)
		mockCreateHashInstance.digest.mockReturnValue("0123456789abcdef0123456789abcdef")
	})

	it("creates Qdrant adapter with provider metadata", () => {
		const adapter = VectorStoreFactory.create({
			provider: "qdrant",
			workspacePath: "/test/workspace",
			dimension: 1536,
			qdrant: { url: "http://localhost:6333" },
		})
		expect(adapter.provider()).toBe("qdrant")
		expect(adapter.collectionName()).toBe("ws-0123456789abcdef")
	})

	it("supports collection suffix to isolate feature data", () => {
		const adapter = VectorStoreFactory.create({
			provider: "qdrant",
			workspacePath: "/test/workspace",
			dimension: 1536,
			collectionSuffix: "chatmemory",
			qdrant: { url: "http://localhost:6333" },
		})
		expect(adapter.collectionName()).toBe("ws-0123456789abcdef-chatmemory")
	})

	it("throws error with dynamic supported providers list for unsupported provider", () => {
		expect(() => {
			VectorStoreFactory.create({
				provider: "unsupported-provider",
				workspacePath: "/test/workspace",
				dimension: 1536,
			})
		}).toThrow(UnsupportedProviderError)

		try {
			VectorStoreFactory.create({
				provider: "unsupported-provider",
				workspacePath: "/test/workspace",
				dimension: 1536,
			})
		} catch (error) {
			expect(error).toBeInstanceOf(UnsupportedProviderError)
			expect(error.message).toContain("Unsupported vector store provider: unsupported-provider")
			expect(error.message).toContain("Currently supported: qdrant")
		}
	})

	it("returns list of supported providers", () => {
		const supportedProviders = VectorStoreFactory.getSupportedProviders()
		expect(supportedProviders).toEqual(["qdrant"])
	})

	it("allows registering new providers", () => {
		// Save original state
		const originalProviders = VectorStoreFactory.getSupportedProviders()

		// Register a new provider
		VectorStoreFactory.registerProvider("pinecone")

		// Check that it's now in the supported list
		const updatedProviders = VectorStoreFactory.getSupportedProviders()
		expect(updatedProviders).toContain("pinecone")
		expect(updatedProviders).toContain("qdrant")
		expect(updatedProviders.length).toBe(originalProviders.length + 1)

		// Error message should now include the new provider
		try {
			VectorStoreFactory.create({
				provider: "unsupported-provider",
				workspacePath: "/test/workspace",
				dimension: 1536,
			})
		} catch (error) {
			expect(error.message).toContain("Currently supported: qdrant, pinecone")
		}

		// Clean up - remove the test provider
		// Note: In a real scenario, you'd want a proper cleanup mechanism
		// For this test, we'll just accept that the provider registry is modified
	})

	it("prevents duplicate provider registration", () => {
		const beforeCount = VectorStoreFactory.getSupportedProviders().length

		// Register the same provider twice
		VectorStoreFactory.registerProvider("qdrant")
		VectorStoreFactory.registerProvider("qdrant")

		const afterCount = VectorStoreFactory.getSupportedProviders().length
		expect(afterCount).toBe(beforeCount) // Should not increase
	})
})
