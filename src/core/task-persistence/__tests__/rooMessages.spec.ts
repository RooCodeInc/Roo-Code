// cd src && npx vitest run core/task-persistence/__tests__/rooMessages.spec.ts

import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"

import { detectFormat, readRooMessages, saveRooMessages } from "../apiMessages"
import type { ApiMessage } from "../apiMessages"
import type { RooMessage, RooMessageHistory } from "../rooMessage"
import { ROO_MESSAGE_VERSION } from "../rooMessage"
import * as safeWriteJsonModule from "../../../utils/safeWriteJson"

let tmpBaseDir: string

beforeEach(async () => {
	tmpBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-test-roo-msgs-"))
})

afterEach(async () => {
	await fs.rm(tmpBaseDir, { recursive: true, force: true }).catch(() => {})
})

// ────────────────────────────────────────────────────────────────────────────
// Helper: create a task directory and write a file into it
// ────────────────────────────────────────────────────────────────────────────

async function writeTaskFile(taskId: string, filename: string, content: string): Promise<string> {
	const taskDir = path.join(tmpBaseDir, "tasks", taskId)
	await fs.mkdir(taskDir, { recursive: true })
	const filePath = path.join(taskDir, filename)
	await fs.writeFile(filePath, content, "utf8")
	return filePath
}

// ────────────────────────────────────────────────────────────────────────────
// Sample data
// ────────────────────────────────────────────────────────────────────────────

const sampleRooMessages: RooMessage[] = [
	{ role: "user", content: "Hello" },
	{ role: "assistant", content: "Hi there!" },
]

const sampleV2Envelope: RooMessageHistory = {
	version: 2,
	messages: sampleRooMessages,
}

const sampleLegacyMessages: ApiMessage[] = [
	{ role: "user", content: "Hello from legacy", ts: 1000 },
	{ role: "assistant", content: "Legacy response", ts: 2000 },
]

// ────────────────────────────────────────────────────────────────────────────
// detectFormat
// ────────────────────────────────────────────────────────────────────────────

describe("detectFormat", () => {
	it('returns "v2" for a valid RooMessageHistory envelope', () => {
		expect(detectFormat({ version: 2, messages: [] })).toBe("v2")
		expect(detectFormat({ version: 2, messages: [{ role: "user", content: "hi" }] })).toBe("v2")
	})

	it('returns "legacy" for a plain array', () => {
		expect(detectFormat([])).toBe("legacy")
		expect(detectFormat([{ role: "user", content: "hello" }])).toBe("legacy")
	})

	it('returns "legacy" for a non-object value', () => {
		expect(detectFormat(null)).toBe("legacy")
		expect(detectFormat(undefined)).toBe("legacy")
		expect(detectFormat("string")).toBe("legacy")
		expect(detectFormat(42)).toBe("legacy")
	})

	it('returns "legacy" for an object without version field', () => {
		expect(detectFormat({ messages: [] })).toBe("legacy")
	})

	it('returns "legacy" for an object with wrong version', () => {
		expect(detectFormat({ version: 1, messages: [] })).toBe("legacy")
		expect(detectFormat({ version: 3, messages: [] })).toBe("legacy")
	})

	it('returns "legacy" for an object with version 2 but no messages array', () => {
		expect(detectFormat({ version: 2 })).toBe("legacy")
		expect(detectFormat({ version: 2, messages: "not-array" })).toBe("legacy")
	})
})

// ────────────────────────────────────────────────────────────────────────────
// readRooMessages
// ────────────────────────────────────────────────────────────────────────────

describe("readRooMessages", () => {
	it("reads v2 format and returns messages directly", async () => {
		await writeTaskFile("task-v2", "api_conversation_history.json", JSON.stringify(sampleV2Envelope))

		const result = await readRooMessages({ taskId: "task-v2", globalStoragePath: tmpBaseDir })

		expect(result).toEqual(sampleRooMessages)
	})

	it("reads legacy format and auto-converts to RooMessage", async () => {
		await writeTaskFile("task-legacy", "api_conversation_history.json", JSON.stringify(sampleLegacyMessages))

		const result = await readRooMessages({ taskId: "task-legacy", globalStoragePath: tmpBaseDir })

		expect(result.length).toBeGreaterThan(0)
		expect(result[0]).toHaveProperty("role", "user")
		expect(result[1]).toHaveProperty("role", "assistant")
		// Verify metadata (ts) is preserved through conversion
		expect(result[0]).toHaveProperty("ts", 1000)
		expect(result[1]).toHaveProperty("ts", 2000)
	})

	it("reads legacy claude_messages.json as fallback and converts", async () => {
		const taskDir = path.join(tmpBaseDir, "tasks", "task-old")
		await fs.mkdir(taskDir, { recursive: true })
		// Only write claude_messages.json, NOT api_conversation_history.json
		await fs.writeFile(path.join(taskDir, "claude_messages.json"), JSON.stringify(sampleLegacyMessages), "utf8")

		const result = await readRooMessages({ taskId: "task-old", globalStoragePath: tmpBaseDir })

		expect(result.length).toBeGreaterThan(0)
		expect(result[0]).toHaveProperty("role", "user")
	})

	it("returns empty array for an empty JSON array", async () => {
		await writeTaskFile("task-empty", "api_conversation_history.json", JSON.stringify([]))

		const result = await readRooMessages({ taskId: "task-empty", globalStoragePath: tmpBaseDir })

		expect(result).toEqual([])
	})

	it("returns empty array for v2 envelope with empty messages", async () => {
		const envelope: RooMessageHistory = { version: 2, messages: [] }
		await writeTaskFile("task-empty-v2", "api_conversation_history.json", JSON.stringify(envelope))

		const result = await readRooMessages({ taskId: "task-empty-v2", globalStoragePath: tmpBaseDir })

		expect(result).toEqual([])
	})

	it("returns empty array with warning for invalid JSON", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
		await writeTaskFile("task-corrupt", "api_conversation_history.json", "<<<corrupt>>>")

		const result = await readRooMessages({ taskId: "task-corrupt", globalStoragePath: tmpBaseDir })

		expect(result).toEqual([])
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[readRooMessages] Error parsing file"))

		warnSpy.mockRestore()
	})

	it("returns empty array with warning for non-array legacy data", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
		await writeTaskFile("task-obj", "api_conversation_history.json", JSON.stringify({ not: "an array" }))

		const result = await readRooMessages({ taskId: "task-obj", globalStoragePath: tmpBaseDir })

		expect(result).toEqual([])
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[readRooMessages] Parsed data is not an array"))

		warnSpy.mockRestore()
	})

	it("returns empty array when no history file exists", async () => {
		const taskDir = path.join(tmpBaseDir, "tasks", "task-none")
		await fs.mkdir(taskDir, { recursive: true })

		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		const result = await readRooMessages({ taskId: "task-none", globalStoragePath: tmpBaseDir })

		expect(result).toEqual([])
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("[Roo-Debug] readRooMessages: API conversation history file not found"),
		)

		errorSpy.mockRestore()
	})
})

// ────────────────────────────────────────────────────────────────────────────
// saveRooMessages
// ────────────────────────────────────────────────────────────────────────────

describe("saveRooMessages", () => {
	it("saves messages in v2 envelope format", async () => {
		const taskDir = path.join(tmpBaseDir, "tasks", "task-save")
		await fs.mkdir(taskDir, { recursive: true })

		const success = await saveRooMessages({
			messages: sampleRooMessages,
			taskId: "task-save",
			globalStoragePath: tmpBaseDir,
		})

		expect(success).toBe(true)

		const filePath = path.join(taskDir, "api_conversation_history.json")
		const raw = await fs.readFile(filePath, "utf8")
		const parsed = JSON.parse(raw)

		expect(parsed).toHaveProperty("version", ROO_MESSAGE_VERSION)
		expect(parsed).toHaveProperty("messages")
		expect(parsed.messages).toEqual(sampleRooMessages)
	})

	it("returns false on write failure", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		// Mock safeWriteJson to reject, rather than relying on OS-specific filesystem behavior
		// (e.g. Windows can create /nonexistent/... paths under the current drive root)
		vi.spyOn(safeWriteJsonModule, "safeWriteJson").mockRejectedValueOnce(new Error("simulated write failure"))

		const taskDir = path.join(tmpBaseDir, "tasks", "task-fail")
		await fs.mkdir(taskDir, { recursive: true })

		const success = await saveRooMessages({
			messages: sampleRooMessages,
			taskId: "task-fail",
			globalStoragePath: tmpBaseDir,
		})

		expect(success).toBe(false)
		expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("[saveRooMessages] Failed to save messages"))

		errorSpy.mockRestore()
	})
})

// ────────────────────────────────────────────────────────────────────────────
// Round-trip tests
// ────────────────────────────────────────────────────────────────────────────

describe("round-trip", () => {
	it("save v2 → read v2 produces identical messages", async () => {
		const taskDir = path.join(tmpBaseDir, "tasks", "task-roundtrip")
		await fs.mkdir(taskDir, { recursive: true })

		await saveRooMessages({
			messages: sampleRooMessages,
			taskId: "task-roundtrip",
			globalStoragePath: tmpBaseDir,
		})

		const result = await readRooMessages({ taskId: "task-roundtrip", globalStoragePath: tmpBaseDir })

		expect(result).toEqual(sampleRooMessages)
	})

	it("legacy read → save → read produces consistent RooMessages", async () => {
		const taskId = "task-legacy-roundtrip"
		await writeTaskFile(taskId, "api_conversation_history.json", JSON.stringify(sampleLegacyMessages))

		// First read: converts legacy to RooMessage
		const converted = await readRooMessages({ taskId, globalStoragePath: tmpBaseDir })
		expect(converted.length).toBeGreaterThan(0)

		// Save the converted messages (now in v2 format)
		await saveRooMessages({ messages: converted, taskId, globalStoragePath: tmpBaseDir })

		// Second read: should read v2 format directly
		const reloaded = await readRooMessages({ taskId, globalStoragePath: tmpBaseDir })
		expect(reloaded).toEqual(converted)

		// Verify the file on disk is v2 format
		const taskDir = path.join(tmpBaseDir, "tasks", taskId)
		const raw = await fs.readFile(path.join(taskDir, "api_conversation_history.json"), "utf8")
		const parsed = JSON.parse(raw)
		expect(detectFormat(parsed)).toBe("v2")
	})
})
