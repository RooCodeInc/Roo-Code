import { execa, ExecaError } from "execa"
import psTree from "ps-tree"
import process from "process"

import type { RooTerminal } from "./types"
import { BaseTerminalProcess } from "./BaseTerminalProcess"

export class ExecaTerminalProcess extends BaseTerminalProcess {
	private terminalRef: WeakRef<RooTerminal>
	private aborted = false
	private pid?: number
	private subprocess?: ReturnType<typeof execa>
	private pidUpdatePromise?: Promise<void>

	constructor(terminal: RooTerminal) {
		super()

		this.terminalRef = new WeakRef(terminal)

		this.once("completed", () => {
			this.terminal.busy = false
		})
	}

	public get terminal(): RooTerminal {
		const terminal = this.terminalRef.deref()

		if (!terminal) {
			throw new Error("Unable to dereference terminal")
		}

		return terminal
	}

	public override async run(command: string) {
		this.command = command

		try {
			this.isHot = true

			this.subprocess = execa({
				shell: true,
				cwd: this.terminal.getCurrentWorkingDirectory(),
				all: true,
				env: {
					...process.env,
					// Ensure UTF-8 encoding for Ruby, CocoaPods, etc.
					LANG: "en_US.UTF-8",
					LC_ALL: "en_US.UTF-8",
				},
			})`${command}`

			this.pid = this.subprocess.pid

			// When using shell: true, the PID is for the shell, not the actual command
			// Find the actual command PID after a small delay
			if (this.pid) {
				this.pidUpdatePromise = new Promise<void>((resolve) => {
					setTimeout(() => {
						psTree(this.pid!, (err, children) => {
							if (!err && children.length > 0) {
								// Update PID to the first child (the actual command)
								const actualPid = parseInt(children[0].PID)
								if (!isNaN(actualPid)) {
									this.pid = actualPid
								}
							}
							resolve()
						})
					}, 100)
				})
			}

			const rawStream = this.subprocess.iterable({ from: "all", preserveNewlines: true })

			// Wrap the stream to ensure all chunks are strings (execa can return Uint8Array)
			const stream = (async function* () {
				for await (const chunk of rawStream) {
					yield typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)
				}
			})()

			this.terminal.setActiveStream(stream, this.pid)

			for await (const line of stream) {
				if (this.aborted) {
					break
				}

				this.fullOutput += line

				const now = Date.now()

				if (this.isListening && (now - this.lastEmitTime_ms > 500 || this.lastEmitTime_ms === 0)) {
					this.emitRemainingBufferIfListening()
					this.lastEmitTime_ms = now
				}

				this.startHotTimer(line)
			}

			if (this.aborted) {
				let timeoutId: NodeJS.Timeout | undefined

				const kill = new Promise<void>((resolve) => {
					console.log(`[ExecaTerminalProcess#run] SIGKILL -> ${this.pid}`)

					timeoutId = setTimeout(() => {
						try {
							this.subprocess?.kill("SIGKILL")
						} catch (e) {}

						resolve()
					}, 5_000)
				})

				try {
					await Promise.race([this.subprocess, kill])
				} catch (error) {
					console.log(
						`[ExecaTerminalProcess#run] subprocess termination error: ${error instanceof Error ? error.message : String(error)}`,
					)
				}

				if (timeoutId) {
					clearTimeout(timeoutId)
				}
			}

			this.emit("shell_execution_complete", { exitCode: 0 })
		} catch (error) {
			if (error instanceof ExecaError) {
				console.error(`[ExecaTerminalProcess#run] shell execution error: ${error.message}`)
				this.emit("shell_execution_complete", { exitCode: error.exitCode ?? 0, signalName: error.signal })
			} else {
				console.error(
					`[ExecaTerminalProcess#run] shell execution error: ${error instanceof Error ? error.message : String(error)}`,
				)

				this.emit("shell_execution_complete", { exitCode: 1 })
			}
			this.subprocess = undefined
		}

		this.terminal.setActiveStream(undefined)
		this.emitRemainingBufferIfListening()
		this.stopHotTimer()
		this.emit("completed", this.fullOutput)
		this.emit("continue")
		this.subprocess = undefined
	}

	public override continue() {
		this.isListening = false
		this.removeAllListeners("line")
		this.emit("continue")
	}

	public override abort() {
		this.aborted = true

		// Function to kill entire process tree
		const killProcessTree = (pid: number, signal: NodeJS.Signals = "SIGKILL") => {
			return new Promise<void>((resolve) => {
				psTree(pid, (err, children) => {
					if (!err && children.length > 0) {
						const pids = children.map((p) => parseInt(p.PID))
						console.log(
							`[ExecaTerminalProcess#abort] Killing process tree for PID ${pid}: ${pids.join(", ")}`,
						)

						// Kill children first (bottom-up approach)
						for (const childPid of pids.reverse()) {
							try {
								process.kill(childPid, signal)
							} catch (e) {
								// Process might already be dead
								console.debug(
									`[ExecaTerminalProcess#abort] Failed to send ${signal} to child PID ${childPid}: ${e instanceof Error ? e.message : String(e)}`,
								)
							}
						}
					}

					// Then kill the parent
					try {
						process.kill(pid, signal)
					} catch (e) {
						console.debug(
							`[ExecaTerminalProcess#abort] Failed to send ${signal} to parent PID ${pid}: ${e instanceof Error ? e.message : String(e)}`,
						)
					}

					resolve()
				})
			})
		}

		// Function to perform the kill operations
		const performKill = async () => {
			const command = this.command?.toLowerCase() || ""
			const needsAggressiveTermination =
				command.includes("pnpm") ||
				command.includes("npm") ||
				command.includes("yarn") ||
				command.includes("bun")

			if (needsAggressiveTermination) {
				console.log(
					`[ExecaTerminalProcess#abort] Detected package manager command, using aggressive termination`,
				)

				// First try SIGTERM to allow graceful shutdown
				if (this.subprocess) {
					try {
						this.subprocess.kill("SIGTERM")
					} catch (e) {
						console.debug(
							`[ExecaTerminalProcess#abort] Failed to send SIGTERM to subprocess: ${e instanceof Error ? e.message : String(e)}`,
						)
					}
				}

				// Kill the entire process tree with SIGTERM first
				if (this.pid) {
					await killProcessTree(this.pid, "SIGTERM")
				}

				// Wait a bit for graceful shutdown
				await new Promise((resolve) => setTimeout(resolve, 500))

				// Then force kill with SIGKILL if still running
				if (this.subprocess && !this.subprocess.killed) {
					try {
						this.subprocess.kill("SIGKILL")
					} catch (e) {
						console.debug(
							`[ExecaTerminalProcess#abort] Failed to send SIGKILL to subprocess: ${e instanceof Error ? e.message : String(e)}`,
						)
					}
				}

				// Force kill the entire process tree
				if (this.pid) {
					await killProcessTree(this.pid, "SIGKILL")
				}
			} else {
				// For regular commands, use the standard approach
				if (this.subprocess) {
					try {
						this.subprocess.kill("SIGKILL")
					} catch (e) {
						console.warn(
							`[ExecaTerminalProcess#abort] Failed to kill subprocess: ${e instanceof Error ? e.message : String(e)}`,
						)
					}
				}

				// Kill the stored PID and its children
				if (this.pid) {
					await killProcessTree(this.pid, "SIGKILL")
				}
			}
		}

		// If PID update is in progress, wait for it before killing
		if (this.pidUpdatePromise) {
			this.pidUpdatePromise.then(() => performKill()).catch(() => performKill())
		} else {
			performKill()
		}
	}

	public override hasUnretrievedOutput() {
		return this.lastRetrievedIndex < this.fullOutput.length
	}

	public override getUnretrievedOutput() {
		let output = this.fullOutput.slice(this.lastRetrievedIndex)
		let index = output.lastIndexOf("\n")

		if (index === -1) {
			return ""
		}

		index++
		this.lastRetrievedIndex += index

		// console.log(
		// 	`[ExecaTerminalProcess#getUnretrievedOutput] fullOutput.length=${this.fullOutput.length} lastRetrievedIndex=${this.lastRetrievedIndex}`,
		// 	output.slice(0, index),
		// )

		return output.slice(0, index)
	}

	private emitRemainingBufferIfListening() {
		if (!this.isListening) {
			return
		}

		const output = this.getUnretrievedOutput()

		if (output !== "") {
			this.emit("line", output)
		}
	}
}
