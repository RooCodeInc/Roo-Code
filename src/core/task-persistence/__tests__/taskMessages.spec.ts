import { describe, it, expect, vi, beforeEach } from "vitest"
import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"

// Mocks (use hoisted to avoid initialization ordering issues)
const hoisted = vi.hoisted(() => ({
	safeWriteJsonMock: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: hoisted.safeWriteJsonMock,
}))

// Import after mocks
import { saveTaskMessages, readTaskMessages } from "../taskMessages"

let tmpBaseDir: string

beforeEach(async () => {
	hoisted.safeWriteJsonMock.mockClear()
	// Create a unique, writable temp directory to act as globalStoragePath
	tmpBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-test-"))
})

describe("taskMessages.saveTaskMessages", () => {
	beforeEach(() => {
		hoisted.safeWriteJsonMock.mockClear()
	})

	it("persists messages as-is", async () => {
		const messages: any[] = [
			{
				role: "assistant",
				content: "Hello",
				metadata: {
					other: "keep",
				},
			},
			{ role: "user", content: "Do thing" },
		]

		await saveTaskMessages({
			messages,
			taskId: "task-1",
			globalStoragePath: tmpBaseDir,
		})

		expect(hoisted.safeWriteJsonMock).toHaveBeenCalledTimes(1)
		const [, persisted] = hoisted.safeWriteJsonMock.mock.calls[0]
		expect(persisted).toEqual(messages)
	})

	it("persists messages without modification when no metadata", async () => {
		const messages: any[] = [
			{ role: "assistant", content: "Hi" },
			{ role: "user", content: "Yo" },
		]

		await saveTaskMessages({
			messages,
			taskId: "task-2",
			globalStoragePath: tmpBaseDir,
		})

		const [, persisted] = hoisted.safeWriteJsonMock.mock.calls[0]
		expect(persisted).toEqual(messages)
	})
})

describe("taskMessages.readTaskMessages", () => {
	it("returns empty array when file contains invalid JSON", async () => {
		const taskId = "task-corrupt-json"
		// Manually create the task directory and write corrupted JSON
		const taskDir = path.join(tmpBaseDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })
		const filePath = path.join(taskDir, "ui_messages.json")
		await fs.writeFile(filePath, "{not valid json!!!", "utf8")

		const result = await readTaskMessages({
			taskId,
			globalStoragePath: tmpBaseDir,
		})

		expect(result).toEqual([])
	})

	it("returns [] when file contains valid JSON that is not an array", async () => {
		const taskId = "task-non-array-json"
		const taskDir = path.join(tmpBaseDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })
		const filePath = path.join(taskDir, "ui_messages.json")
		await fs.writeFile(filePath, JSON.stringify("hello"), "utf8")

		const result = await readTaskMessages({
			taskId,
			globalStoragePath: tmpBaseDir,
		})

		expect(result).toEqual([])
	})
})
