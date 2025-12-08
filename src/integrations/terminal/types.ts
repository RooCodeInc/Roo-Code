import EventEmitter from "events"

export type RooTerminalProvider = "vscode" | "execa"

export interface RooTerminal {
	provider: RooTerminalProvider
	id: number
	busy: boolean
	running: boolean
	taskId?: string
	process?: RooTerminalProcess
	getCurrentWorkingDirectory(): string
	isClosed: () => boolean
	runCommand: (command: string, callbacks: RooTerminalCallbacks) => RooTerminalProcessResultPromise
	setActiveStream(stream: AsyncIterable<string> | undefined, pid?: number): void
	shellExecutionComplete(exitDetails: ExitCodeDetails): void
	getProcessesWithOutput(): RooTerminalProcess[]
	getUnretrievedOutput(): string
	getLastCommand(): string
	cleanCompletedProcessQueue(): void
}

export interface RooTerminalCallbacks {
	onLine: (line: string, process: RooTerminalProcess) => void
	onCompleted: (output: string | undefined, process: RooTerminalProcess) => void
	onShellExecutionStarted: (pid: number | undefined, process: RooTerminalProcess) => void
	onShellExecutionComplete: (details: ExitCodeDetails, process: RooTerminalProcess) => void
	onNoShellIntegration?: (message: string, process: RooTerminalProcess) => void
}

export interface RooTerminalProcess extends EventEmitter<RooTerminalProcessEvents> {
	command: string
	isHot: boolean
	run: (command: string) => Promise<void>
	continue: () => void
	abort: () => Promise<void>
	hasUnretrievedOutput: () => boolean
	getUnretrievedOutput: () => string
	/**
	 * Get all unretrieved output including incomplete lines (without newline at the end)
	 * This method does NOT update lastRetrievedIndex, so it can be called multiple times
	 * to peek at the current output without consuming it.
	 * 获取所有未检索的输出，包括不完整的行（没有换行符的行）
	 * 此方法不会更新 lastRetrievedIndex，所以可以多次调用来查看当前输出而不消费它
	 */
	peekAllUnretrievedOutput: () => string
}

export type RooTerminalProcessResultPromise = RooTerminalProcess & Promise<void>

export interface RooTerminalProcessEvents {
	line: [line: string]
	continue: []
	completed: [output?: string]
	stream_available: [stream: AsyncIterable<string>]
	shell_execution_started: [pid: number | undefined]
	shell_execution_complete: [exitDetails: ExitCodeDetails]
	error: [error: Error]
	no_shell_integration: [message: string]
}

export interface ExitCodeDetails {
	exitCode: number | undefined
	signal?: number | undefined
	signalName?: string
	coreDumpPossible?: boolean
}
