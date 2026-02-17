// cd src && npx vitest run core/task-persistence/__tests__/apiMessages.spec.ts

import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"

import { readApiMessages } from "../apiMessages"

let tmpBaseDir: string

beforeEach(async () => {
	tmpBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-test-api-"))
})

describe("apiMessages.readApiMessages", () => {
	it("returns empty array when api_conversation_history.json contains invalid JSON", async () => {
		const taskId = "task-corrupt-api"
		const taskDir = path.join(tmpBaseDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })
		const filePath = path.join(taskDir, "api_conversation_history.json")
		await fs.writeFile(filePath, "<<<corrupt data>>>", "utf8")

		const result = await readApiMessages({
			taskId,
			globalStoragePath: tmpBaseDir,
		})

		expect(result).toEqual([])
	})

	it("returns empty array when claude_messages.json fallback contains invalid JSON", async () => {
		const taskId = "task-corrupt-fallback"
		const taskDir = path.join(tmpBaseDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })

		// Only write the old fallback file (claude_messages.json), NOT the new one
		const oldPath = path.join(taskDir, "claude_messages.json")
		await fs.writeFile(oldPath, "not json at all {[!", "utf8")

		const result = await readApiMessages({
			taskId,
			globalStoragePath: tmpBaseDir,
		})

		expect(result).toEqual([])

		// The corrupted fallback file should NOT be deleted
		const stillExists = await fs
			.access(oldPath)
			.then(() => true)
			.catch(() => false)
		expect(stillExists).toBe(true)
	})

	it("returns [] when file contains valid JSON that is not an array", async () => {
		const taskId = "task-non-array-api"
		const taskDir = path.join(tmpBaseDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })
		const filePath = path.join(taskDir, "api_conversation_history.json")
		await fs.writeFile(filePath, JSON.stringify("hello"), "utf8")

		const result = await readApiMessages({
			taskId,
			globalStoragePath: tmpBaseDir,
		})

		expect(result).toEqual([])
	})

	it("returns [] when fallback file contains valid JSON that is not an array", async () => {
		const taskId = "task-non-array-fallback"
		const taskDir = path.join(tmpBaseDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })

		// Only write the old fallback file, NOT the new one
		const oldPath = path.join(taskDir, "claude_messages.json")
		await fs.writeFile(oldPath, JSON.stringify({ key: "value" }), "utf8")

		const result = await readApiMessages({
			taskId,
			globalStoragePath: tmpBaseDir,
		})

		expect(result).toEqual([])
	})
})
