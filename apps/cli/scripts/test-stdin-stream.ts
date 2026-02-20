import path from "path"
import { fileURLToPath } from "url"
import readline from "readline"

import { execa } from "execa"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cliRoot = path.resolve(__dirname, "..")

async function main() {
	const child = execa(
		"pnpm",
		["dev", "--print", "--stdin-prompt-stream", "--provider", "roo", "--output-format", "stream-json"],
		{
			cwd: cliRoot,
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
			reject: false,
			forceKillAfterDelay: 2_000,
		},
	)

	child.stdout?.on("data", (chunk) => process.stdout.write(chunk))
	child.stderr?.on("data", (chunk) => process.stderr.write(chunk))

	console.log("[wrapper] Type a message and press Enter to send it.")
	console.log("[wrapper] Type /exit to close stdin and let the CLI finish.")

	let requestCounter = 0
	let hasStartedTask = false

	const sendCommand = (payload: Record<string, unknown>) => {
		if (child.stdin?.destroyed) {
			return
		}
		child.stdin?.write(JSON.stringify(payload) + "\n")
	}

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: true,
	})

	rl.on("line", (line) => {
		if (line.trim() === "/exit") {
			console.log("[wrapper] Closing stdin...")
			sendCommand({
				command: "shutdown",
				requestId: `shutdown-${Date.now()}-${++requestCounter}`,
			})
			child.stdin?.end()
			rl.close()
			return
		}

		const command = hasStartedTask ? "message" : "start"
		sendCommand({
			command,
			requestId: `${command}-${Date.now()}-${++requestCounter}`,
			prompt: line,
		})
		hasStartedTask = true
	})

	const onSignal = (signal: NodeJS.Signals) => {
		console.log(`[wrapper] Received ${signal}, forwarding to CLI...`)
		rl.close()
		child.kill(signal)
	}

	process.on("SIGINT", () => onSignal("SIGINT"))
	process.on("SIGTERM", () => onSignal("SIGTERM"))

	const result = await child
	rl.close()
	console.log(`[wrapper] CLI exited with code ${result.exitCode}`)
	process.exit(result.exitCode ?? 1)
}

main().catch((error) => {
	console.error("[wrapper] Fatal error:", error)
	process.exit(1)
})
