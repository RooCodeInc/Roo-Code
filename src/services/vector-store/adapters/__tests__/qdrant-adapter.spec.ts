import { describe, it, expect, beforeEach, vi } from "vitest"
import { QdrantAdapter } from "../qdrant"
import { QdrantClient } from "@qdrant/js-client-rest"
import { createHash } from "crypto"

vi.mock("@qdrant/js-client-rest")
vi.mock("crypto")
vi.mock("../../../i18n", () => ({
	t: (key: string, params?: any) => key,
}))

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

describe("QdrantAdapter URL and init", () => {
	const mockWorkspacePath = "/test/workspace"
	const mockVectorSize = 1536
	const mockHashedPath = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"

	beforeEach(() => {
		vi.clearAllMocks()
		;(QdrantClient as any).mockImplementation(() => mockQdrantClientInstance)
		;(createHash as any).mockReturnValue(mockCreateHashInstance)
		mockCreateHashInstance.update.mockReturnValue(mockCreateHashInstance)
		mockCreateHashInstance.digest.mockReturnValue(mockHashedPath)
	})

	it("https URL without port uses 443 and https", () => {
		new QdrantAdapter(mockWorkspacePath, "https://q.example.com", undefined, mockVectorSize)
		expect(QdrantClient).toHaveBeenLastCalledWith({
			host: "q.example.com",
			https: true,
			port: 443,
			prefix: undefined,
			apiKey: undefined,
			headers: { "User-Agent": "Roo-Code" },
		})
	})

	it("http URL without port uses 80", () => {
		new QdrantAdapter(mockWorkspacePath, "http://example.com", undefined, mockVectorSize)
		expect(QdrantClient).toHaveBeenLastCalledWith({
			host: "example.com",
			https: false,
			port: 80,
			prefix: undefined,
			apiKey: undefined,
			headers: { "User-Agent": "Roo-Code" },
		})
	})

	it("URL with path preserves prefix", () => {
		new QdrantAdapter(mockWorkspacePath, "https://example.com/api/v1", undefined, mockVectorSize)
		expect(QdrantClient).toHaveBeenLastCalledWith({
			host: "example.com",
			https: true,
			port: 443,
			prefix: "/api/v1",
			apiKey: undefined,
			headers: { "User-Agent": "Roo-Code" },
		})
	})

	it("hostname without scheme defaults to http and port 80", () => {
		new QdrantAdapter(mockWorkspacePath, "qdrant.local", undefined, mockVectorSize)
		expect(QdrantClient).toHaveBeenLastCalledWith({
			host: "qdrant.local",
			https: false,
			port: 80,
			prefix: undefined,
			apiKey: undefined,
			headers: { "User-Agent": "Roo-Code" },
		})
	})

	it("appends sanitized collection suffix when provided", () => {
		const adapter = new QdrantAdapter(
			mockWorkspacePath,
			"http://localhost:6333",
			undefined,
			mockVectorSize,
			"Chat Memory!!",
		)
		// hash mocked to a1b2..., base name is ws-a1b2...
		expect(adapter.collectionName()).toBe("ws-a1b2c3d4e5f6g7h8-chat-memory")
	})
})

describe("QdrantAdapter upsert recovery", () => {
	const mockWorkspacePath = "/test/workspace"
	const mockVectorSize = 1536

	beforeEach(() => {
		vi.clearAllMocks()
		;(QdrantClient as any).mockImplementation(() => mockQdrantClientInstance)
	})

	it("retries upsert after ensure on 404 Not Found", async () => {
		// First upsert rejects with 404, second resolves
		const notFound = { status: 404, message: "Not Found" }
		mockQdrantClientInstance.upsert.mockRejectedValueOnce(notFound).mockResolvedValueOnce({})

		const adapter = new QdrantAdapter(mockWorkspacePath, "http://localhost:6333", undefined, mockVectorSize)

		// Stub ensureCollection to avoid calling the real endpoint flow
		const ensureSpy = vi.spyOn(adapter as any, "ensureCollection").mockResolvedValue(true)

		await adapter.upsert([
			{
				id: "1",
				vector: [0.1, 0.2],
				payload: { filePath: "src/a.ts", codeChunk: "x", startLine: 1, endLine: 2 },
			},
		])

		expect(mockQdrantClientInstance.upsert).toHaveBeenCalledTimes(2)
		expect(ensureSpy).toHaveBeenCalledTimes(1)
	})
})
