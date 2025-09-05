import { describe, it, expect, vi, beforeEach } from "vitest"
import { VectorStoreFactory } from "../factory"
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
})
