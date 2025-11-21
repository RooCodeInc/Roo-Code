import type { RooTerminalCallbacks, RooTerminalProcessResultPromise } from "./types"
import { BaseTerminal } from "./BaseTerminal"
import { ExecaTerminalProcess } from "./ExecaTerminalProcess"
import { mergePromise } from "./mergePromise"
import delay from "delay"

export class ExecaTerminal extends BaseTerminal {
	constructor(id: number, cwd: string) {
		super("execa", id, cwd)
	}

	/**
	 * Unlike the VSCode terminal, this is never closed.
	 */
	public override isClosed(): boolean {
		return false
	}

	public override runCommand(command: string, callbacks: RooTerminalCallbacks): RooTerminalProcessResultPromise {
		this.busy = true

		const process = new ExecaTerminalProcess(this)
		process.command = command
		this.process = process
		let isOutputFirstLine = true
		process.on("line", (line) => {
			isOutputFirstLine = false
			callbacks.onLine(line, process)
		})
		process.once("completed", (output) => callbacks.onCompleted(output, process))
		process.once("shell_execution_started", (pid) => callbacks.onShellExecutionStarted(pid, process))
		process.once("shell_execution_complete", (details) => callbacks.onShellExecutionComplete(details, process))

		const promise = new Promise<void>((resolve, reject) => {
			process.once("continue", () => resolve())
			process.once("error", (error) => reject(error))
			process.run(command)
			delay(300).then(() => {
				if (!isOutputFirstLine) return
				callbacks?.triggerUIToProceed?.("", process)
			})
		})

		return mergePromise(process, promise)
	}
}
