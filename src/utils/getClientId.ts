import * as vscode from "vscode"
import * as os from "os"
import * as path from "path"
import crypto from "crypto"

// Import filesystem functions
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs"
import { computeHash } from "../core/costrict"

const isInvalidId = (id: string): boolean => {
	return (
		!id ||
		id.trim() === "" ||
		[
			"intellij-machine",
			"development-machine",
			"intellij-session",
			"development-session",
			"someValue.machineId",
		].includes(id) ||
		id.length < 64
	)
}

// Cache for client ID
let clientIdCache: string | null = null

// Gets the path to client ID file
const getClientIdFilePath = (): string => {
	return path.join(os.homedir(), ".costrict", ".clientId")
}

// Gets .zgsm directory path
const getZgsmDirPath = (): string => {
	return path.join(os.homedir(), ".costrict")
}

// Generates new client ID
const generateNewClientId = (): string => {
	let machineId = vscode?.env?.machineId
	if (isInvalidId(machineId)) {
		machineId = computeHash(getUuid() + `${Date.now()}`)
	}
	return `${machineId}${vscode?.env?.remoteName ? `.${crypto.randomUUID().slice(0, 8)}` : ""}`
}

let sessionId = ""
// Generates new sessionId
export const generateNewSessionClientId = (): string => {
	if (sessionId && !isInvalidId(sessionId)) {
		return sessionId
	}
	sessionId = vscode?.env?.sessionId
	if (isInvalidId(sessionId)) {
		sessionId = getUuid()
	}

	return `${sessionId}${vscode?.env?.remoteName ? `.${crypto.randomUUID().slice(0, 8)}` : ""}`
}

// Exported function to get client ID
export const getClientId = (): string => {
	// Return cached ID if available
	if (clientIdCache !== null && !isInvalidId(clientIdCache)) {
		return clientIdCache
	}

	try {
		// Get client ID file path
		const clientIdFilePath = getClientIdFilePath()

		// Read existing ID file if available
		if (existsSync(clientIdFilePath)) {
			const content = readFileSync(clientIdFilePath, "utf-8")
			if (!isInvalidId(content)) {
				clientIdCache = content
				return content
			}
		}

		// Generate new ID
		const newClientId = generateNewClientId()
		const zgsmDir = getZgsmDirPath()

		// Create .zgsm directory if not exists
		if (!existsSync(zgsmDir)) {
			mkdirSync(zgsmDir, { recursive: true })
		}

		// Write new ID to file and cache it
		writeFileSync(clientIdFilePath, newClientId)
		clientIdCache = newClientId
		return newClientId
	} catch (error) {
		// Fallback with new ID if error occurs
		console.error("Error in getClientId:", error)
		const fallbackId = generateNewClientId()
		clientIdCache = fallbackId
		return fallbackId
	}
}

/**
 * Generate a UUID
 */
export function getUuid() {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
		const r = (Math.random() * 16) | 0,
			v = c === "x" ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}
