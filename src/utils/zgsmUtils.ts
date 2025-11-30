import os from "os"

import * as vscode from "vscode"
import { getClientId } from "./getClientId"
import osName from "os-name"
import { Package } from "../shared/package"

export function getParams(state: string, ignore: string[] = []) {
	return [
		["machine_code", getClientId()],
		["state", state],
		["provider", "casdoor"],
		["plugin_version", Package.version],
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

function getSafeOperatingSystemName(): string {
	try {
		return osName(os.platform(), os.release())
	} catch (error) {
		console.warn(`[zgsm getOperatingSystem] os-name failed: ${error.message}`)

		const platform = os.platform()
		const release = os.release()

		const platformMap: Record<string, string> = {
			win32: "Windows",
			darwin: "macOS",
			linux: "Linux",
			freebsd: "FreeBSD",
			openbsd: "OpenBSD",
			sunos: "SunOS",
			aix: "AIX",
		}

		const platformName = platformMap[platform] || platform

		try {
			if (platform === "win32") {
				const majorVersion = parseInt(release.split(".")[0], 10)
				const versionMap: Record<number, string> = {
					10: "Windows 10/11",
					6: "Windows Vista/7/8",
					5: "Windows XP/2000",
				}
				return versionMap[majorVersion] || `Windows ${release}`
			} else if (platform === "darwin") {
				const versionParts = release.split(".")
				if (versionParts.length >= 2) {
					const major = parseInt(versionParts[0], 10)
					const minor = parseInt(versionParts[1], 10)
					return `macOS ${major}.${minor}`
				}
			}

			return `${platformName} ${release}`
		} catch (innerError) {
			console.warn(`[zgsm getOperatingSystem] Fallback failed: ${innerError.message}`)
			return platformName
		}
	}
}

let operatingSystem = ""

export const getOperatingSystem = () => {
	if (operatingSystem) return operatingSystem
	return (operatingSystem = getSafeOperatingSystemName())
}
