import fs from "fs/promises"
import path from "path"

import { getConfigDir } from "./index.js"

const OPENAI_CODEX_CREDENTIALS_FILE = path.join(getConfigDir(), "openai-codex-credentials.json")

export interface OpenAiCodexCredentials {
	type: "openai-codex"
	access_token: string
	refresh_token: string
	expires: number
	email?: string
	accountId?: string
}

export async function saveOpenAiCodexCredentials(credentials: OpenAiCodexCredentials): Promise<void> {
	await fs.mkdir(getConfigDir(), { recursive: true })

	await fs.writeFile(OPENAI_CODEX_CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), {
		mode: 0o600, // Read/write for owner only
	})
}

export async function loadOpenAiCodexCredentials(): Promise<OpenAiCodexCredentials | null> {
	try {
		const data = await fs.readFile(OPENAI_CODEX_CREDENTIALS_FILE, "utf-8")
		return JSON.parse(data) as OpenAiCodexCredentials
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return null
		}
		throw error
	}
}

export async function clearOpenAiCodexCredentials(): Promise<void> {
	try {
		await fs.unlink(OPENAI_CODEX_CREDENTIALS_FILE)
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw error
		}
	}
}

export async function hasOpenAiCodexCredentials(): Promise<boolean> {
	const credentials = await loadOpenAiCodexCredentials()
	return credentials !== null
}

export function getOpenAiCodexCredentialsPath(): string {
	return OPENAI_CODEX_CREDENTIALS_FILE
}
