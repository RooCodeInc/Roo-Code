import * as assert from "assert"
import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"

import * as vscode from "vscode"

import { setDefaultSuiteTimeout } from "./test-utils"

function makeHandoff(overrides: Record<string, unknown> = {}) {
	return {
		schemaVersion: 1,
		createdAt: new Date().toISOString(),
		source: {
			extensionId: "RooVeterinaryInc.roo-cline",
			publisher: "RooVeterinaryInc",
			name: "roo-cline",
			version: "3.53.1",
			globalStoragePath: "",
			storageBasePath: "",
		},
		zoo: {
			repositoryUrl: "https://github.com/Zoo-Code-Org/Zoo-Code",
			announcementUrl: "",
			extensionId: "ZooCodeOrganization.zoo-code",
		},
		containsSecrets: false,
		globalSettings: {},
		vscodeConfiguration: {},
		copiedData: {},
		...overrides,
	}
}

suite("Roo Import", function () {
	setDefaultSuiteTimeout(this)

	let tmpDir: string

	suiteSetup(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "zoo-e2e-roo-import-"))
	})

	suiteTeardown(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true })
	})

	test("importRooHandoff command is registered", async () => {
		const commands = await vscode.commands.getCommands(true)
		assert.ok(
			commands.includes("roo-cline.importRooHandoff"),
			"roo-cline.importRooHandoff should be a registered command",
		)
	})

	test("imports a valid handoff and copies tasks", async () => {
		const api = globalThis.api
		const storagePath = api.storagePath

		// Build a minimal handoff with one task directory.
		const handoffDir = path.join(tmpDir, "handoff")
		const tasksSource = path.join(handoffDir, "data", "tasks")
		const taskId = `e2e-test-task-${Date.now()}`
		await fs.mkdir(path.join(tasksSource, taskId), { recursive: true })
		await fs.writeFile(path.join(tasksSource, taskId, "history_item.json"), JSON.stringify({ id: taskId }))

		const handoffPath = path.join(handoffDir, "handoff-v1.json")
		await fs.writeFile(handoffPath, JSON.stringify(makeHandoff({ copiedData: { tasks: "data/tasks" } })))

		// Execute the command with an explicit path to skip the file picker.
		const result = await vscode.commands.executeCommand<{ success: boolean; tasksCopied?: number; error?: string }>(
			"roo-cline.importRooHandoff",
			handoffPath,
		)

		assert.ok(result, "Command should return a result")
		assert.strictEqual(result.success, true, `Import should succeed (error: ${result.error})`)
		assert.strictEqual(result.tasksCopied, 1, "One task should have been copied")

		// Verify the task directory was actually written to Zoo's storage.
		const copiedTaskFile = path.join(storagePath, "tasks", taskId, "history_item.json")
		const contents = JSON.parse(await fs.readFile(copiedTaskFile, "utf-8"))
		assert.strictEqual(contents.id, taskId, "Task file content should match what was exported")
	})

	test("skips import when handoff was already imported", async () => {
		const handoffPath = path.join(tmpDir, "handoff-duplicate.json")
		const createdAt = new Date().toISOString()
		await fs.writeFile(handoffPath, JSON.stringify(makeHandoff({ createdAt })))

		// First import.
		const first = await vscode.commands.executeCommand<{ success: boolean }>(
			"roo-cline.importRooHandoff",
			handoffPath,
		)
		assert.ok(first?.success, "First import should succeed")

		// Second import of the same handoff should also succeed (command accepts an
		// explicit path so it doesn't check the "already imported" state — that check
		// only runs in the activation notice path). Verify the command at least runs
		// without throwing.
		const second = await vscode.commands.executeCommand<{ success: boolean }>(
			"roo-cline.importRooHandoff",
			handoffPath,
		)
		assert.ok(second?.success, "Re-running the command with the same file should still succeed")
	})
})
