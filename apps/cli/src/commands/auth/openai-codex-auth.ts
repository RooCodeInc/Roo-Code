import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import pWaitFor from "p-wait-for"

import { getProviderDefaultModelId, type ExtensionMessage } from "@roo-code/types"

import { type ExtensionHostOptions, ExtensionHost } from "@/agent/index.js"
import { getDefaultExtensionPath } from "@/lib/utils/extension.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const OPENAI_CODEX_AUTH_TIMEOUT_MS = 300_000

export interface OpenAiCodexAuthOptions {
	workspace?: string
	extension?: string
	debug?: boolean
	timeoutMs?: number
}

export interface OpenAiCodexSignInResult {
	success: boolean
	reason?: string
}

export interface OpenAiCodexSignOutResult {
	success: boolean
	wasAuthenticated: boolean
	reason?: string
}

function resolveWorkspacePath(workspace: string | undefined): string {
	const resolved = workspace ? path.resolve(workspace) : process.cwd()

	if (!fs.existsSync(resolved)) {
		throw new Error(`Workspace path does not exist: ${resolved}`)
	}

	return resolved
}

function resolveExtensionPath(extension: string | undefined): string {
	const resolved = path.resolve(extension || getDefaultExtensionPath(__dirname))

	if (!fs.existsSync(path.join(resolved, "extension.js"))) {
		throw new Error(`Extension bundle not found at: ${resolved}`)
	}

	return resolved
}

async function withOpenAiCodexHost<T>(
	options: OpenAiCodexAuthOptions,
	fn: (host: ExtensionHost) => Promise<T>,
): Promise<T> {
	const extensionHostOptions: ExtensionHostOptions = {
		mode: "code",
		reasoningEffort: undefined,
		user: null,
		provider: "openai-codex",
		model: getProviderDefaultModelId("openai-codex"),
		workspacePath: resolveWorkspacePath(options.workspace),
		extensionPath: resolveExtensionPath(options.extension),
		nonInteractive: true,
		ephemeral: false,
		debug: options.debug ?? false,
		exitOnComplete: true,
		exitOnError: false,
		disableOutput: true,
		skipInitialSettingsSync: true,
	}

	const host = new ExtensionHost(extensionHostOptions)

	await host.activate()
	await pWaitFor(() => host.client.isInitialized(), {
		interval: 25,
		timeout: 2_000,
	}).catch(() => undefined)

	try {
		return await fn(host)
	} finally {
		await host.dispose()
	}
}

function isOpenAiCodexAuthenticated(host: ExtensionHost): boolean {
	return host.client.getProviderAuthState().openAiCodexIsAuthenticated === true
}

async function waitForOpenAiCodexAuthState(
	host: ExtensionHost,
	expectedState: boolean,
	timeoutMs: number,
): Promise<boolean> {
	if (isOpenAiCodexAuthenticated(host) === expectedState) {
		return true
	}

	return new Promise<boolean>((resolve) => {
		let settled = false

		const cleanup = () => {
			if (settled) {
				return
			}

			settled = true
			clearTimeout(timeoutId)
			host.off("extensionWebviewMessage", onMessage)
		}

		const finish = (result: boolean) => {
			cleanup()
			resolve(result)
		}

		const onMessage = (message: ExtensionMessage) => {
			if (message.type !== "state" || !message.state || message.state.openAiCodexIsAuthenticated === undefined) {
				return
			}

			if (message.state.openAiCodexIsAuthenticated === expectedState) {
				finish(true)
			}
		}

		const timeoutId = setTimeout(() => finish(false), timeoutMs)

		host.on("extensionWebviewMessage", onMessage)
	})
}

export async function loginWithOpenAiCodex(options: OpenAiCodexAuthOptions = {}): Promise<OpenAiCodexSignInResult> {
	try {
		return await withOpenAiCodexHost(options, async (host) => {
			const authResult = await host.ensureOpenAiCodexAuthenticated({
				timeoutMs: options.timeoutMs ?? OPENAI_CODEX_AUTH_TIMEOUT_MS,
			})

			if (authResult.success) {
				return { success: true }
			}

			return { success: false, reason: authResult.reason }
		})
	} catch (error) {
		return {
			success: false,
			reason: error instanceof Error ? error.message : String(error),
		}
	}
}

export async function logoutOpenAiCodex(options: OpenAiCodexAuthOptions = {}): Promise<OpenAiCodexSignOutResult> {
	try {
		return await withOpenAiCodexHost(options, async (host) => {
			const wasAuthenticated = isOpenAiCodexAuthenticated(host)

			if (!wasAuthenticated) {
				return { success: true, wasAuthenticated: false }
			}

			host.sendToExtension({ type: "openAiCodexSignOut" })

			const signedOut = await waitForOpenAiCodexAuthState(host, false, options.timeoutMs ?? 10_000)

			if (!signedOut) {
				return {
					success: false,
					wasAuthenticated: true,
					reason: "Timed out waiting for OpenAI Codex sign-out to complete.",
				}
			}

			return { success: true, wasAuthenticated: true }
		})
	} catch (error) {
		return {
			success: false,
			wasAuthenticated: false,
			reason: error instanceof Error ? error.message : String(error),
		}
	}
}

export async function statusOpenAiCodex(
	options: OpenAiCodexAuthOptions = {},
): Promise<{ authenticated: boolean; reason?: string }> {
	try {
		return await withOpenAiCodexHost(options, async (host) => ({
			authenticated: isOpenAiCodexAuthenticated(host),
		}))
	} catch (error) {
		return {
			authenticated: false,
			reason: error instanceof Error ? error.message : String(error),
		}
	}
}
