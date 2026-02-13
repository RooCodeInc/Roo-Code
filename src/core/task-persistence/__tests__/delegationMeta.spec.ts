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
import { readDelegationMeta, saveDelegationMeta } from "../delegationMeta"
import type { DelegationMeta } from "../delegationMeta"

let tmpBaseDir: string

beforeEach(async () => {
	hoisted.safeWriteJsonMock.mockClear()
	tmpBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-test-delegation-"))
})

describe("delegationMeta.readDelegationMeta", () => {
	it("returns null when file does not exist (backward compat)", async () => {
		const result = await readDelegationMeta({
			taskId: "task-no-file",
			globalStoragePath: tmpBaseDir,
		})

		expect(result).toBeNull()
	})

	it("returns parsed delegation metadata from file", async () => {
		const taskId = "task-with-meta"
		const taskDir = path.join(tmpBaseDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })
		const filePath = path.join(taskDir, "delegation_metadata.json")

		const meta: DelegationMeta = {
			status: "delegated",
			delegatedToId: "child-1",
			awaitingChildId: "child-1",
			childIds: ["child-1"],
		}
		await fs.writeFile(filePath, JSON.stringify(meta), "utf8")

		const result = await readDelegationMeta({
			taskId,
			globalStoragePath: tmpBaseDir,
		})

		expect(result).toEqual(meta)
	})

	it("filters out unknown keys from parsed data", async () => {
		const taskId = "task-extra-keys"
		const taskDir = path.join(tmpBaseDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })
		const filePath = path.join(taskDir, "delegation_metadata.json")

		await fs.writeFile(
			filePath,
			JSON.stringify({
				status: "active",
				unknownField: "should-be-filtered",
				childIds: ["c1"],
			}),
			"utf8",
		)

		const result = await readDelegationMeta({
			taskId,
			globalStoragePath: tmpBaseDir,
		})

		expect(result).toEqual({ status: "active", childIds: ["c1"] })
		expect(result).not.toHaveProperty("unknownField")
	})

	it("returns null when file contains invalid JSON", async () => {
		const taskId = "task-corrupt"
		const taskDir = path.join(tmpBaseDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })
		const filePath = path.join(taskDir, "delegation_metadata.json")
		await fs.writeFile(filePath, "{not valid json!!!", "utf8")

		const result = await readDelegationMeta({
			taskId,
			globalStoragePath: tmpBaseDir,
		})

		expect(result).toBeNull()
	})

	it("returns null when file contains a non-object value", async () => {
		const taskId = "task-non-object"
		const taskDir = path.join(tmpBaseDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })
		const filePath = path.join(taskDir, "delegation_metadata.json")
		await fs.writeFile(filePath, JSON.stringify("hello"), "utf8")

		const result = await readDelegationMeta({
			taskId,
			globalStoragePath: tmpBaseDir,
		})

		expect(result).toBeNull()
	})

	it("returns null when file contains an array", async () => {
		const taskId = "task-array"
		const taskDir = path.join(tmpBaseDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })
		const filePath = path.join(taskDir, "delegation_metadata.json")
		await fs.writeFile(filePath, JSON.stringify([1, 2, 3]), "utf8")

		const result = await readDelegationMeta({
			taskId,
			globalStoragePath: tmpBaseDir,
		})

		expect(result).toBeNull()
	})
})

describe("delegationMeta.saveDelegationMeta", () => {
	it("writes delegation metadata via safeWriteJson", async () => {
		const meta: DelegationMeta = {
			status: "delegated",
			delegatedToId: "child-1",
			awaitingChildId: "child-1",
			childIds: ["child-1"],
		}

		await saveDelegationMeta({
			taskId: "task-1",
			globalStoragePath: tmpBaseDir,
			meta,
		})

		expect(hoisted.safeWriteJsonMock).toHaveBeenCalledTimes(1)
		const [, persisted] = hoisted.safeWriteJsonMock.mock.calls[0]
		expect(persisted).toEqual(meta)
	})

	it("filters out unknown keys before writing", async () => {
		const meta = {
			status: "active",
			unknownField: "should-be-filtered",
			childIds: ["c1"],
		} as any

		await saveDelegationMeta({
			taskId: "task-2",
			globalStoragePath: tmpBaseDir,
			meta,
		})

		expect(hoisted.safeWriteJsonMock).toHaveBeenCalledTimes(1)
		const [, persisted] = hoisted.safeWriteJsonMock.mock.calls[0]
		expect(persisted).toEqual({ status: "active", childIds: ["c1"] })
		expect(persisted).not.toHaveProperty("unknownField")
	})

	it("writes to the correct file path", async () => {
		await saveDelegationMeta({
			taskId: "task-path-check",
			globalStoragePath: tmpBaseDir,
			meta: { status: "completed" },
		})

		expect(hoisted.safeWriteJsonMock).toHaveBeenCalledTimes(1)
		const [filePath] = hoisted.safeWriteJsonMock.mock.calls[0]
		expect(filePath).toContain(path.join("tasks", "task-path-check", "delegation_metadata.json"))
	})
})
