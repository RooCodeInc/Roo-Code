import os from "os"

import * as vscode from "vscode"
import { getClientId } from "./getClientId"
import osName from "os-name"

export function getParams(state: string, ignore: string[] = []) {
	return [
		["machine_code", getClientId()],
		["state", state],
		["provider", "casdoor"],
		["plugin_version", "1.5.3"],
		// ["plugin_version", Package.version],
		["vscode_version", vscode.version],
		["uri_scheme", vscode.env.uriScheme],
	].filter(([key]) => !ignore.includes(key))
}

export async function retryWrapper<T>(
	rid: string,
	fn: () => Promise<T>,
	interval = (attempt: number) => 1000 * Math.pow(2, attempt),
	maxAttempt = 3,
): Promise<T> {
	let lastError: Error | undefined
	const _maxAttempt = Math.max(1, maxAttempt)
	let attempt = 0
	for (; attempt < _maxAttempt; attempt++) {
		try {
			return await fn()
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error))
			console.warn(`[${rid}] Attempt ${attempt + 1} failed:`, lastError.message)
			await new Promise((resolve) => setTimeout(resolve, interval(attempt)))
		}
	}
	throw lastError || new Error(`Operation failed after ${attempt} attempts`)
}

export function getLocalIP(): string {
	try {
		const interfaces = os.networkInterfaces()
		for (const key in interfaces) {
			for (const alias of interfaces[key] ?? []) {
				if (alias.family === "IPv4" && alias.address !== "127.0.0.1" && !alias.internal) {
					return alias.address
				}
			}
		}
	} catch (error) {
		console.log(`[zgsm getLocalIP]: ${error.message}`)
	}

	return "127.0.0.1"
}

let operatingSystem = ""

export const getOperatingSystem = () => {
	if (operatingSystem) return operatingSystem
	return (operatingSystem = osName(os.platform(), os.release()))
}
