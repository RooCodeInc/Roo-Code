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

	/**
	 * Cross-platform helper function to force kill process
	 * @param pid Process ID
	 * @param isMainProcess Whether it's the main process (main process needs to kill process tree)
	 * @returns Whether termination was successful
	 */
	private async forceKillProcess(pid: number, isMainProcess: boolean = false): Promise<boolean> {
		const platform = process.platform

		if (platform === "win32") {
			// Windows: use taskkill
			try {
				const args = isMainProcess
					? ["/PID", pid.toString(), "/F", "/T"] // Main process: kill process tree
					: ["/PID", pid.toString(), "/F"] // Child process: kill single process only

				await execa("taskkill", args)
				console.log(`[ExecaTerminalProcess#forceKillProcess] Successfully killed process ${pid} using taskkill`)
				return true
			} catch (error) {
				console.error(
					`[ExecaTerminalProcess#forceKillProcess] Failed to kill process ${pid} using taskkill: ${error instanceof Error ? error.message : String(error)}`,
				)
				return false
			}
		} else {
			// Linux/Unix/macOS: use kill -9
			try {
				if (isMainProcess) {
					// Main process: try to kill process tree first, then kill main process
					try {
						await execa("pkill", ["-9", "-P", pid.toString()])
						console.log(`[ExecaTerminalProcess#forceKillProcess] Killed process tree for PID ${pid}`)
					} catch (pkillError) {
						// pkill may fail (if no child processes), continue trying kill
						console.warn(
							`[ExecaTerminalProcess#forceKillProcess] pkill failed (may have no children): ${pkillError instanceof Error ? pkillError.message : String(pkillError)}`,
						)
					}
				}

				// Force kill process
				await execa("kill", ["-9", pid.toString()])
				console.log(`[ExecaTerminalProcess#forceKillProcess] Successfully killed process ${pid} using kill -9`)
				return true
			} catch (error) {
				console.error(
					`[ExecaTerminalProcess#forceKillProcess] Failed to kill process ${pid} using kill -9: ${error instanceof Error ? error.message : String(error)}`,
				)
				return false
			}
		}
	}

	/**
	 * More aggressive process group termination method (used after all regular methods fail)
	 * @param pid Process ID
	 * @returns Whether termination was successful
	 */
	private async forceKillProcessGroup(pid: number): Promise<boolean> {
		const platform = process.platform

		if (platform === "win32") {
			// Windows: use taskkill to force kill process tree, including all child processes, with multiple retries
			try {
				// Try multiple times to ensure process is terminated
				for (let i = 0; i < 3; i++) {
					try {
						await execa("taskkill", ["/PID", pid.toString(), "/F", "/T"], {
							timeout: 2000,
						})
						console.log(
							`[ExecaTerminalProcess#forceKillProcessGroup] Successfully killed process tree ${pid} (attempt ${i + 1})`,
						)
						return true
					} catch (error) {
						if (i === 2) {
							// Last attempt failed
							console.error(
								`[ExecaTerminalProcess#forceKillProcessGroup] Failed to kill process tree ${pid} after 3 attempts: ${error instanceof Error ? error.message : String(error)}`,
							)
							return false
						}
						// Wait a bit before retrying
						await new Promise((resolve) => setTimeout(resolve, 500))
					}
				}
				// If loop ends normally (shouldn't happen in theory), return false as fallback
				return false
			} catch (error) {
				console.error(
					`[ExecaTerminalProcess#forceKillProcessGroup] Error killing process tree: ${error instanceof Error ? error.message : String(error)}`,
				)
				return false
			}
		} else {
			// Linux/Unix/macOS: kill entire process group
			try {
				// Use negative PID to kill entire process group
				await execa("kill", ["-9", `-${pid}`])
				console.log(`[ExecaTerminalProcess#forceKillProcessGroup] Successfully killed process group ${pid}`)
				return true
			} catch (error) {
				// If process group kill fails, try other methods
				console.warn(
					`[ExecaTerminalProcess#forceKillProcessGroup] Failed to kill process group: ${error instanceof Error ? error.message : String(error)}`,
				)

				// Fallback: use pkill to kill process tree
				try {
					await execa("pkill", ["-9", "-P", pid.toString()])
					await execa("kill", ["-9", pid.toString()])
					console.log(`[ExecaTerminalProcess#forceKillProcessGroup] Successfully killed using pkill + kill`)
					return true
				} catch (pkillError) {
					console.error(
						`[ExecaTerminalProcess#forceKillProcessGroup] All methods failed: ${pkillError instanceof Error ? pkillError.message : String(pkillError)}`,
					)
					return false
				}
			}
		}
	}

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

	public override async abort(): Promise<void> {
		this.aborted = true

		// Simplified process termination function: directly use process group kill (most reliable method)
		const performKill = async () => {
			if (!this.pid) {
				// If no PID, only cleanup subprocess
				if (this.subprocess) {
					try {
						if (typeof (this.subprocess as any).cancel === "function") {
							;(this.subprocess as any).cancel()
						}
						this.subprocess = undefined
					} catch (e) {
						console.warn(
							`[ExecaTerminalProcess#abort] Failed to cleanup subprocess: ${e instanceof Error ? e.message : String(e)}`,
						)
					}
				}
				return
			}

			console.log(`[ExecaTerminalProcess#abort] Terminating process ${this.pid} and its process group`)

			// Directly use process group kill (most reliable method, kills all related processes at once)
			const killed = await this.forceKillProcessGroup(this.pid)

			if (!killed) {
				// If process group kill fails, try individual process kill as fallback
				console.warn(
					`[ExecaTerminalProcess#abort] Process group kill failed, trying individual process kill as fallback`,
				)
				await this.forceKillProcess(this.pid, true)
			}

			// Verify process is actually terminated
			await new Promise((resolve) => setTimeout(resolve, 500))
			try {
				process.kill(this.pid, 0)
				// Process is still running
				console.error(
					`[ExecaTerminalProcess#abort] Process ${this.pid} still running after all termination attempts`,
				)
			} catch (e) {
				// Process has been terminated
				console.log(`[ExecaTerminalProcess#abort] Process ${this.pid} successfully terminated`)
			}

			// Cleanup subprocess object
			if (this.subprocess) {
				try {
					// Try to cancel subprocess (if supported)
					if (typeof (this.subprocess as any).cancel === "function") {
						;(this.subprocess as any).cancel()
					}
					// Cleanup subprocess reference
					this.subprocess = undefined
					console.log(`[ExecaTerminalProcess#abort] Subprocess object cleaned up`)
				} catch (e) {
					console.warn(
						`[ExecaTerminalProcess#abort] Failed to cleanup subprocess: ${e instanceof Error ? e.message : String(e)}`,
					)
				}
			}
		}

		// If PID update is in progress, wait for it before killing
		if (this.pidUpdatePromise) {
			await this.pidUpdatePromise.then(() => performKill()).catch(() => performKill())
		} else {
			await performKill()
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
