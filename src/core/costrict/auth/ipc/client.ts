import * as net from "net"
import { getIPCPath } from "./utils"

let client: net.Socket | null = null
const ipcPath = getIPCPath()
const onTokensUpdateCallbacks: ((tokens: any) => void)[] = []
const onLogoutCallbacks: ((sessionId: string) => void)[] = []
const onCloseWindowCallbacks: ((sessionId: string) => void)[] = []
let isConnecting = false
let retryTimeout: NodeJS.Timeout | null = null

export function connectIPC() {
	if (client && !client.destroyed) {
		return
	}

	if (isConnecting) {
		return
	}

	isConnecting = true
	if (retryTimeout) clearTimeout(retryTimeout)

	console.log("Connecting to IPC server...")
	client = net.createConnection({ path: ipcPath })

	client.on("connect", () => {
		console.log("Connected to IPC server.")
		isConnecting = false
	})

	client.on("data", (data) => {
		try {
			const message = JSON.parse(data.toString())
			if (message.type === "zgsm-tokens") {
				onTokensUpdateCallbacks.forEach((cb) => cb(message.payload))
			}
			if (message.type === "zgsm-logout") {
				onLogoutCallbacks.forEach((cb) => cb(message.payload))
			}
			if (message.type === "zgsm-close-window") {
				onCloseWindowCallbacks.forEach((cb) => cb(message.payload))
			}
		} catch (error) {
			console.error("Failed to parse IPC message:", error)
		}
	})

	client.on("end", () => {
		console.log("Disconnected from IPC server.")
		client?.destroy()
		client = null
		isConnecting = false
		retryTimeout = setTimeout(connectIPC, 5000) // Retry after 5 seconds
	})

	client.on("error", (err: NodeJS.ErrnoException) => {
		console.error("IPC connection error:", err.message)
		isConnecting = false
		if (client) {
			client.destroy()
			client = null
		}
		// Don't retry immediately on error to avoid tight loops
		if (err.code !== "ECONNREFUSED") {
			retryTimeout = setTimeout(connectIPC, 5000)
		}
	})
}

export function sendZgsmTokens(tokens: { state: string; access_token: string; refresh_token: string }) {
	if (client && !client.destroyed) {
		try {
			const message = JSON.stringify({ type: "zgsm-tokens", payload: tokens })
			client.write(message)
		} catch (error) {
			console.error("Failed to send tokens over IPC:", error)
		}
	} else {
		console.warn("IPC client not connected, cannot send tokens.")
	}
}

export function sendZgsmLogout(sessionId: string) {
	if (client && !client.destroyed) {
		try {
			const message = JSON.stringify({ type: "zgsm-logout", payload: sessionId })
			client.write(message)
		} catch (error) {
			console.error("Failed to send tokens over IPC:", error)
		}
	} else {
		console.warn("IPC client not connected, cannot send tokens.")
	}
}
export function sendZgsmCloseWindow(sessionId: string) {
	if (!client || client.destroyed) {
		return
	}

	try {
		const message = JSON.stringify({ type: "zgsm-close-window", payload: sessionId })
		client.write(message)
	} catch (error) {
		console.error("Failed to send tokens over IPC:", error)
	}
}

export function onZgsmLogout(callback: (sessionId: string) => void) {
	onLogoutCallbacks.push(callback)
	return {
		dispose: () => {
			const index = onLogoutCallbacks.indexOf(callback)
			if (index > -1) {
				onLogoutCallbacks.splice(index, 1)
			}
		},
	}
}

export function onCloseWindow(callback: (sessionId: string) => void) {
	onCloseWindowCallbacks.push(callback)
	return {
		dispose: () => {
			const index = onCloseWindowCallbacks.indexOf(callback)
			if (index > -1) {
				onCloseWindowCallbacks.splice(index, 1)
			}
		},
	}
}

export function onZgsmTokensUpdate(
	callback: (tokens: { state: string; access_token: string; refresh_token: string }) => void,
) {
	onTokensUpdateCallbacks.push(callback)
	return {
		dispose: () => {
			const index = onTokensUpdateCallbacks.indexOf(callback)
			if (index > -1) {
				onTokensUpdateCallbacks.splice(index, 1)
			}
		},
	}
}

export function disconnectIPC() {
	if (retryTimeout) {
		clearTimeout(retryTimeout)
		retryTimeout = null
	}
	if (client) {
		client.destroy()
		client = null
	}
}
