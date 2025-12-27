import * as path from "path"
import * as vscode from "vscode"

import { runMatrix } from "@roo-code/evally"
import type { MatrixSuiteDefinition } from "@roo-code/evally"
import type { RooCodeAPI } from "@roo-code/types"

import { waitFor } from "./utils"

type TestGlobals = typeof globalThis & {
	api?: RooCodeAPI
	rooTestWorkspaceDir?: string
}

const getTestGlobals = (): TestGlobals => globalThis as TestGlobals

export async function run() {
	const extension = vscode.extensions.getExtension<RooCodeAPI>("RooVeterinaryInc.roo-cline")

	if (!extension) {
		throw new Error("Extension not found")
	}

	const api = extension.isActive ? extension.exports : await extension.activate()

	await api.setConfiguration({
		apiProvider: "openrouter" as const,
		openRouterApiKey: process.env.OPENROUTER_API_KEY!,
		openRouterModelId: process.env.OPENROUTER_MODEL_ID || "openai/gpt-5.1",
	})

	await vscode.commands.executeCommand("roo-cline.SidebarProvider.focus")
	await waitFor(() => api.isReady())
	const globals = getTestGlobals()
	globals.api = api

	const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
	if (workspaceDir) {
		globals.rooTestWorkspaceDir = workspaceDir
	}

	const suiteModule = await import(path.resolve(__dirname, "./applyDiff.matrix.test"))
	const moduleDefault = (suiteModule as { default?: MatrixSuiteDefinition }).default

	if (!moduleDefault || typeof moduleDefault !== "object" || typeof moduleDefault.tests !== "function") {
		throw new Error("Skipping applyDiff.matrix.test: No valid matrix suite export")
	}

	const suiteDef: MatrixSuiteDefinition = moduleDefault

	await runMatrix(suiteDef)
}
