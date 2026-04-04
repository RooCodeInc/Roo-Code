import EventEmitter from "events"

export type RooTerminalProvider = "vscode" | "execa"

export interface RooTerminal {
	provider: RooTerminalProvider
	id: number
	busy: boolean
	running: boolean
	taskId?: string
	process?: JabberwockTerminalProcess
	getCurrentWorkingDirectory(): string
	isClosed: () => boolean
	runCommand: (command: string, callbacks: RooTerminalCallbacks) => JabberwockTerminalProcessResultPromise
	setActiveStream(stream: AsyncIterable<string> | undefined, pid?: number): void
	shellExecutionComplete(exitDetails: ExitCodeDetails): void
	getProcessesWithOutput(): JabberwockTerminalProcess[]
	getUnretrievedOutput(): string
	getLastCommand(): string
	cleanCompletedProcessQueue(): void
}

export interface RooTerminalCallbacks {
	onLine: (line: string, process: JabberwockTerminalProcess) => void
	onCompleted: (output: string | undefined, process: JabberwockTerminalProcess) => void | Promise<void>
	onShellExecutionStarted: (pid: number | undefined, process: JabberwockTerminalProcess) => void
	onShellExecutionComplete: (details: ExitCodeDetails, process: JabberwockTerminalProcess) => void
	onNoShellIntegration?: (message: string, process: JabberwockTerminalProcess) => void
}

export interface JabberwockTerminalProcess extends EventEmitter<JabberwockTerminalProcessEvents> {
	command: string
	isHot: boolean
	run: (command: string) => Promise<void>
	continue: () => void
	abort: () => void
	hasUnretrievedOutput: () => boolean
	getUnretrievedOutput: () => string
	trimRetrievedOutput: () => void
}

export type JabberwockTerminalProcessResultPromise = JabberwockTerminalProcess & Promise<void>

export interface JabberwockTerminalProcessEvents {
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
