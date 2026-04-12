import { vscode } from "../../../utils/vscode"

const originalConsole = {
	log: console.log.bind(console),
	warn: console.warn.bind(console),
	error: console.error.bind(console),
	debug: console.debug.bind(console),
}

const LOG_METHODS = ["log", "warn", "error", "debug"] as const

const serializeArg = (arg: unknown) => {
	if (arg instanceof Error) return arg.stack || arg.message
	if (typeof arg === "object" && arg !== null) {
		try {
			return JSON.stringify(arg)
		} catch {
			return String(arg)
		}
	}
	return String(arg)
}

export function initWebviewConsoleBridge() {
	LOG_METHODS.forEach((method) => {
		const original = originalConsole[method]
		;(console as unknown as Record<string, (...args: unknown[]) => void>)[method] = (...args: unknown[]) => {
			original(...args)

			try {
				const messageStr = args.map(serializeArg).join(" ")
				vscode.postMessage({
					type: "webviewLog",
					text: `[WEBVIEW][${method.toUpperCase()}] ${messageStr}`,
				})
			} catch {
				// Serialization safety — never break the caller
			}
		}
	})
}
