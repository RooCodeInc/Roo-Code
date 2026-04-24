import fs from "fs/promises"
import path from "path"

/**
 * OpenAI Codex OAuth credentials storage for CLI.
 *
 * Stores credentials in the same location as the vscode-shim's FileSecretStorage
 * (~/.vscode-mock/global-storage/secrets.json) so the existing OpenAiCodexOAuthManager
 * can find them transparently when the extension loads.
 */

const STORAGE_BASE_DIR = ".vscode-mock"
const SECRETS_KEY = "openai-codex-oauth-credentials"

// Credentials type (matches src/integrations/openai-codex/oauth.ts)
export interface OpenAiCodexCredentials {
	type: "openai-codex"
	access_token: string
	refresh_token: string
	expires: number
	email?: string
	accountId?: string
}

function isValidCredentials(obj: unknown): obj is OpenAiCodexCredentials {
	if (!obj || typeof obj !== "object") return false
	const o = obj as Record<string, unknown>
	return (
		o.type === "openai-codex" &&
		typeof o.access_token === "string" &&
		o.access_token.length > 0 &&
		typeof o.refresh_token === "string" &&
		o.refresh_token.length > 0 &&
		typeof o.expires === "number"
	)
}

function getSecretsFilePath(): string {
	const homeDir = process.env.HOME || process.env.USERPROFILE || "."
	return path.join(homeDir, STORAGE_BASE_DIR, "global-storage", "secrets.json")
}

async function readSecretsFile(): Promise<Record<string, string>> {
	try {
		const data = await fs.readFile(getSecretsFilePath(), "utf-8")
		return JSON.parse(data)
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return {}
		}
		throw error
	}
}

async function writeSecretsFile(secrets: Record<string, string>): Promise<void> {
	const filePath = getSecretsFilePath()
	const dir = path.dirname(filePath)
	await fs.mkdir(dir, { recursive: true })
	await fs.writeFile(filePath, JSON.stringify(secrets, null, 2), { mode: 0o600 })
}

export async function saveOpenAiCodexCredentials(credentials: OpenAiCodexCredentials): Promise<void> {
	const secrets = await readSecretsFile()
	secrets[SECRETS_KEY] = JSON.stringify(credentials)
	await writeSecretsFile(secrets)
}

export async function loadOpenAiCodexCredentials(): Promise<OpenAiCodexCredentials | null> {
	try {
		const secrets = await readSecretsFile()
		const raw = secrets[SECRETS_KEY]
		if (!raw) {
			return null
		}
		const parsed = JSON.parse(raw)
		if (!isValidCredentials(parsed)) {
			return null
		}
		return parsed
	} catch {
		return null
	}
}

export async function clearOpenAiCodexCredentials(): Promise<void> {
	try {
		const secrets = await readSecretsFile()
		delete secrets[SECRETS_KEY]
		await writeSecretsFile(secrets)
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw error
		}
	}
}

export async function hasOpenAiCodexCredentials(): Promise<boolean> {
	const creds = await loadOpenAiCodexCredentials()
	return creds !== null
}

/**
 * Check if the stored credentials have an expired access token (with 5 min buffer).
 */
export function isCredentialsExpired(credentials: OpenAiCodexCredentials): boolean {
	const bufferMs = 5 * 60 * 1000
	return Date.now() >= credentials.expires - bufferMs
}
