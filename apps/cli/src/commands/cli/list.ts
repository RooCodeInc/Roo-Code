import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import pWaitFor from "p-wait-for"

import type { Command, ModelRecord, WebviewMessage } from "@roo-code/types"
import { getProviderDefaultModelId } from "@roo-code/types"

import { ExtensionHost, type ExtensionHostOptions } from "@/agent/index.js"
import { loadToken } from "@/lib/storage/index.js"
import { getDefaultExtensionPath } from "@/lib/utils/extension.js"
import { getApiKeyFromEnv } from "@/lib/utils/provider.js"
import { isRecord } from "@/lib/utils/guards.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REQUEST_TIMEOUT_MS = 10_000

type ListFormat = "json" | "text"

type BaseListOptions = {
	workspace?: string
	extension?: string
	apiKey?: string
	format?: string
	debug?: boolean
}

type CommandLike = Pick<Command, "name" | "source" | "filePath" | "description" | "argumentHint">
type ModeLike = { slug: string; name: string }

export function parseFormat(rawFormat: string | undefined): ListFormat {
	const format = (rawFormat ?? "json").toLowerCase()
	if (format === "json" || format === "text") {
		return format
	}

	throw new Error(`Invalid format: ${rawFormat}. Must be "json" or "text".`)
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

function outputJson(data: unknown): void {
	process.stdout.write(JSON.stringify(data, null, 2) + "\n")
}

function outputCommandsText(commands: CommandLike[]): void {
	for (const command of commands) {
		const description = command.description ? ` - ${command.description}` : ""
		process.stdout.write(`/${command.name} (${command.source})${description}\n`)
	}
}

function outputModesText(modes: ModeLike[]): void {
	for (const mode of modes) {
		process.stdout.write(`${mode.slug}\t${mode.name}\n`)
	}
}

function outputModelsText(models: ModelRecord): void {
	for (const modelId of Object.keys(models).sort()) {
		process.stdout.write(`${modelId}\n`)
	}
}

async function createListHost(options: BaseListOptions): Promise<ExtensionHost> {
	const workspacePath = resolveWorkspacePath(options.workspace)
	const extensionPath = resolveExtensionPath(options.extension)
	const apiKey = options.apiKey || (await loadToken()) || getApiKeyFromEnv("roo")

	const extensionHostOptions: ExtensionHostOptions = {
		mode: "code",
		reasoningEffort: undefined,
		user: null,
		provider: "roo",
		model: getProviderDefaultModelId("roo"),
		apiKey,
		workspacePath,
		extensionPath,
		nonInteractive: true,
		ephemeral: true,
		debug: options.debug ?? false,
		exitOnComplete: true,
		exitOnError: false,
		disableOutput: true,
	}

	const host = new ExtensionHost(extensionHostOptions)
	await host.activate()

	// Best effort wait; mode/commands requests can still succeed without this.
	await pWaitFor(() => host.client.isInitialized(), {
		interval: 25,
		timeout: 2_000,
	}).catch(() => undefined)

	return host
}

/**
 * Send a request to the extension and wait for a matching response message.
 * Returns `undefined` from `extract` to skip non-matching messages, or the
 * parsed value to resolve the promise.
 */
function requestFromExtension<T>(
	host: ExtensionHost,
	requestType: WebviewMessage["type"],
	extract: (message: Record<string, unknown>) => T | undefined,
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		let settled = false

		const cleanup = () => {
			clearTimeout(timeoutId)
			host.off("extensionWebviewMessage", onMessage)
			offError()
		}

		const finish = (fn: () => void) => {
			if (settled) return
			settled = true
			cleanup()
			fn()
		}

		const onMessage = (message: unknown) => {
			if (!isRecord(message)) {
				return
			}

			let result: T | undefined
			try {
				result = extract(message)
			} catch (error) {
				finish(() => reject(error instanceof Error ? error : new Error(String(error))))
				return
			}

			if (result !== undefined) {
				finish(() => resolve(result))
			}
		}

		const offError = host.client.on("error", (error) => {
			finish(() => reject(error))
		})

		const timeoutId = setTimeout(() => {
			finish(() =>
				reject(new Error(`Timed out waiting for ${requestType} response after ${REQUEST_TIMEOUT_MS}ms`)),
			)
		}, REQUEST_TIMEOUT_MS)

		host.on("extensionWebviewMessage", onMessage)
		host.sendToExtension({ type: requestType })
	})
}

function requestCommands(host: ExtensionHost): Promise<CommandLike[]> {
	return requestFromExtension(host, "requestCommands", (message) => {
		if (message.type !== "commands") {
			return undefined
		}
		return Array.isArray(message.commands) ? (message.commands as CommandLike[]) : []
	})
}

function requestModes(host: ExtensionHost): Promise<ModeLike[]> {
	return requestFromExtension(host, "requestModes", (message) => {
		if (message.type !== "modes") {
			return undefined
		}
		return Array.isArray(message.modes) ? (message.modes as ModeLike[]) : []
	})
}

function requestRooModels(host: ExtensionHost): Promise<ModelRecord> {
	return requestFromExtension(host, "requestRooModels", (message) => {
		if (message.type !== "singleRouterModelFetchResponse") {
			return undefined
		}

		const values = isRecord(message.values) ? message.values : undefined
		if (values?.provider !== "roo") {
			return undefined
		}

		if (message.success === false) {
			const errorMessage =
				typeof message.error === "string" && message.error.length > 0
					? message.error
					: "Failed to fetch Roo models"
			throw new Error(errorMessage)
		}

		return isRecord(values.models) ? (values.models as ModelRecord) : {}
	})
}

async function withHostAndSignalHandlers<T>(
	options: BaseListOptions,
	fn: (host: ExtensionHost) => Promise<T>,
): Promise<T> {
	const host = await createListHost(options)

	const shutdown = async (exitCode: number) => {
		await host.dispose()
		process.exit(exitCode)
	}

	const onSigint = () => void shutdown(130)
	const onSigterm = () => void shutdown(143)

	process.on("SIGINT", onSigint)
	process.on("SIGTERM", onSigterm)

	try {
		return await fn(host)
	} finally {
		process.off("SIGINT", onSigint)
		process.off("SIGTERM", onSigterm)
		await host.dispose()
	}
}

export async function listCommands(options: BaseListOptions): Promise<void> {
	const format = parseFormat(options.format)

	await withHostAndSignalHandlers(options, async (host) => {
		const commands = await requestCommands(host)

		if (format === "json") {
			outputJson({ commands })
			return
		}

		outputCommandsText(commands)
	})
}

export async function listModes(options: BaseListOptions): Promise<void> {
	const format = parseFormat(options.format)

	await withHostAndSignalHandlers(options, async (host) => {
		const modes = await requestModes(host)

		if (format === "json") {
			outputJson({ modes })
			return
		}

		outputModesText(modes)
	})
}

export async function listModels(options: BaseListOptions): Promise<void> {
	const format = parseFormat(options.format)

	await withHostAndSignalHandlers(options, async (host) => {
		const models = await requestRooModels(host)

		if (format === "json") {
			outputJson({ models })
			return
		}

		outputModelsText(models)
	})
}
