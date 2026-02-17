import fs from "fs/promises"
import path from "path"

import * as vscode from "vscode"

import safeWriteJson from "../../utils/safeWriteJson"
import { getWorkspacePath } from "../../utils/path"

import type { ActiveIntentRecord } from "./types"

const ORCHESTRATION_DIR = ".orchestration"
const ACTIVE_INTENT_FILE = "active_intent.json"

function getWorkspaceRoot(fallbackCwd?: string): string {
	return getWorkspacePath(fallbackCwd ?? process.cwd())
}

function getOrchestrationDir(workspaceRoot: string): string {
	return path.join(workspaceRoot, ORCHESTRATION_DIR)
}

function getActiveIntentFilePath(workspaceRoot: string): string {
	return path.join(getOrchestrationDir(workspaceRoot), ACTIVE_INTENT_FILE)
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isValidIntent(value: unknown): value is ActiveIntentRecord {
	if (!value || typeof value !== "object") {
		return false
	}
	const intent = value as ActiveIntentRecord
	return (
		typeof intent.id === "string" &&
		typeof intent.title === "string" &&
		typeof intent.description === "string" &&
		isStringArray(intent.scope) &&
		isStringArray(intent.acceptanceCriteria) &&
		typeof intent.createdAt === "string" &&
		typeof intent.updatedAt === "string"
	)
}

export async function loadActiveIntent(fallbackCwd?: string): Promise<ActiveIntentRecord | null> {
	const workspaceRoot = getWorkspaceRoot(fallbackCwd)
	const filePath = getActiveIntentFilePath(workspaceRoot)
	try {
		const raw = await fs.readFile(filePath, "utf-8")
		const parsed = JSON.parse(raw) as unknown
		return isValidIntent(parsed) ? parsed : null
	} catch (error: any) {
		if (error?.code === "ENOENT") {
			return null
		}
		throw error
	}
}

export async function saveActiveIntent(intent: ActiveIntentRecord, fallbackCwd?: string): Promise<string> {
	const workspaceRoot = getWorkspaceRoot(fallbackCwd)
	const dirPath = getOrchestrationDir(workspaceRoot)
	await fs.mkdir(dirPath, { recursive: true })
	const filePath = getActiveIntentFilePath(workspaceRoot)
	await safeWriteJson(filePath, intent, { prettyPrint: true })
	return filePath
}

export async function clearActiveIntent(fallbackCwd?: string): Promise<void> {
	const workspaceRoot = getWorkspaceRoot(fallbackCwd)
	const filePath = getActiveIntentFilePath(workspaceRoot)
	try {
		await fs.unlink(filePath)
	} catch (error: any) {
		if (error?.code !== "ENOENT") {
			throw error
		}
	}
}

function parseCsv(input: string): string[] {
	return input
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean)
}

export async function promptAndSetActiveIntent(fallbackCwd?: string): Promise<ActiveIntentRecord | null> {
	const now = new Date().toISOString()
	const existingIntent = await loadActiveIntent(fallbackCwd)
	const id = await vscode.window.showInputBox({
		title: "Set Active Intent",
		prompt: "Intent ID",
		value: existingIntent?.id ?? "",
		ignoreFocusOut: true,
	})
	if (!id) {
		return null
	}

	const title = await vscode.window.showInputBox({
		title: "Set Active Intent",
		prompt: "Intent title",
		value: existingIntent?.title ?? "",
		ignoreFocusOut: true,
	})
	if (!title) {
		return null
	}

	const description = await vscode.window.showInputBox({
		title: "Set Active Intent",
		prompt: "Intent description",
		value: existingIntent?.description ?? "",
		ignoreFocusOut: true,
	})
	if (!description) {
		return null
	}

	const scopeInput = await vscode.window.showInputBox({
		title: "Set Active Intent",
		prompt: "Scope patterns (comma-separated, e.g. src/**/*.ts,README.md)",
		value: existingIntent?.scope?.join(", ") ?? "src/**",
		ignoreFocusOut: true,
	})
	if (!scopeInput) {
		return null
	}

	const acceptanceInput = await vscode.window.showInputBox({
		title: "Set Active Intent",
		prompt: "Acceptance criteria (comma-separated)",
		value: existingIntent?.acceptanceCriteria?.join(", ") ?? "",
		ignoreFocusOut: true,
	})
	if (acceptanceInput === undefined) {
		return null
	}

	const intent: ActiveIntentRecord = {
		id: id.trim(),
		title: title.trim(),
		description: description.trim(),
		scope: parseCsv(scopeInput),
		acceptanceCriteria: parseCsv(acceptanceInput),
		createdAt: existingIntent?.createdAt ?? now,
		updatedAt: now,
	}

	await saveActiveIntent(intent, fallbackCwd)
	return intent
}

export async function showActiveIntent(fallbackCwd?: string): Promise<void> {
	const intent = await loadActiveIntent(fallbackCwd)
	if (!intent) {
		vscode.window.showInformationMessage("No active intent is currently set.")
		return
	}
	vscode.window.showInformationMessage(
		`Active Intent: ${intent.id} | ${intent.title} | Scope: ${intent.scope.join(", ")}`,
	)
}
