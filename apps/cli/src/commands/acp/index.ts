import { Readable, Writable } from "node:stream"
import path from "node:path"
import { fileURLToPath } from "node:url"

import * as acpSdk from "@agentclientprotocol/sdk"

import { type SupportedProvider, DEFAULT_FLAGS } from "@/types/index.js"
import { getDefaultExtensionPath } from "@/lib/utils/extension.js"
import { RooCodeAgent, acpLog } from "@/acp/index.js"

export interface AcpCommandOptions {
	extension?: string
	provider?: SupportedProvider
	model?: string
	mode?: string
	apiKey?: string
}

export async function runAcpServer(options: AcpCommandOptions): Promise<void> {
	const __dirname = path.dirname(fileURLToPath(import.meta.url))
	const extensionPath = options.extension || getDefaultExtensionPath(__dirname)

	if (!extensionPath) {
		console.error("Error: Extension path not found. Use --extension to specify the path.")
		process.exit(1)
	}

	// Set up stdio streams for ACP communication.
	// Note: We write to stdout (agent -> client) and read from stdin (client -> agent).
	const stdout = Writable.toWeb(process.stdout) as WritableStream<Uint8Array>
	const stdin = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>

	const stream = acpSdk.ndJsonStream(stdout, stdin)
	acpLog.info("Command", "ACP stream created, waiting for connection")

	let agent: RooCodeAgent | null = null

	const connection = new acpSdk.AgentSideConnection((conn: acpSdk.AgentSideConnection) => {
		acpLog.info("Command", "Agent connection established")
		agent = new RooCodeAgent(
			{
				extensionPath,
				provider: options.provider ?? DEFAULT_FLAGS.provider,
				model: options.model || DEFAULT_FLAGS.model,
				mode: options.mode || DEFAULT_FLAGS.mode,
				apiKey: options.apiKey || process.env.OPENROUTER_API_KEY,
			},
			conn,
		)

		return agent
	}, stream)

	const cleanup = async () => {
		acpLog.info("Command", "Received shutdown signal, cleaning up")

		if (agent) {
			await agent.dispose()
		}

		acpLog.info("Command", "Cleanup complete, exiting")
		process.exit(0)
	}

	process.on("SIGINT", cleanup)
	process.on("SIGTERM", cleanup)

	acpLog.info("Command", "Waiting for connection to close")
	await connection.closed
	acpLog.info("Command", "Connection closed")
}

export async function acp(options: AcpCommandOptions): Promise<void> {
	try {
		await runAcpServer(options)
	} catch (error) {
		acpLog.error("Command", "Fatal error", error)
		console.error(error)
		process.exit(1)
	}
}
