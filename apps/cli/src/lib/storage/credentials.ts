import fs from "fs/promises"
import path from "path"

import type { SupportedProvider } from "@/types/index.js"

import { getConfigDir } from "./index.js"

const CREDENTIALS_FILE = path.join(getConfigDir(), "cli-credentials.json")

export interface Credentials {
	token?: string
	createdAt: string
	userId?: string
	orgId?: string
	apiKeys?: Partial<Record<SupportedProvider, string>>
}

async function loadCredentialsFromDisk(): Promise<Credentials | null> {
	try {
		const data = await fs.readFile(CREDENTIALS_FILE, "utf-8")
		return JSON.parse(data) as Credentials
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return null
		}
		throw error
	}
}

async function saveCredentials(credentials: Credentials): Promise<void> {
	await fs.mkdir(getConfigDir(), { recursive: true })
	await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), {
		mode: 0o600,
	})
}

export async function saveToken(token: string, options?: { userId?: string; orgId?: string }): Promise<void> {
	const existing = await loadCredentialsFromDisk()

	const credentials: Credentials = {
		token,
		createdAt: new Date().toISOString(),
		userId: options?.userId,
		orgId: options?.orgId,
		apiKeys: existing?.apiKeys,
	}

	await saveCredentials(credentials)
}

export async function loadToken(): Promise<string | null> {
	const credentials = await loadCredentialsFromDisk()
	return credentials?.token ?? null
}

export async function loadCredentials(): Promise<Credentials | null> {
	return loadCredentialsFromDisk()
}

export async function saveProviderApiKey(provider: SupportedProvider, apiKey: string): Promise<void> {
	const existing = await loadCredentialsFromDisk()
	const credentials: Credentials = {
		token: existing?.token,
		createdAt: existing?.createdAt ?? new Date().toISOString(),
		userId: existing?.userId,
		orgId: existing?.orgId,
		apiKeys: {
			...(existing?.apiKeys ?? {}),
			[provider]: apiKey,
		},
	}

	await saveCredentials(credentials)
}

export async function loadProviderApiKey(provider: SupportedProvider): Promise<string | null> {
	const credentials = await loadCredentialsFromDisk()
	return credentials?.apiKeys?.[provider] ?? null
}

export async function clearToken(): Promise<void> {
	const credentials = await loadCredentialsFromDisk()
	if (!credentials) {
		return
	}

	const { token: _token, userId: _userId, orgId: _orgId, ...rest } = credentials
	const hasApiKeys = Boolean(rest.apiKeys && Object.keys(rest.apiKeys).length > 0)

	if (!hasApiKeys) {
		try {
			await fs.unlink(CREDENTIALS_FILE)
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				throw error
			}
		}
		return
	}

	await saveCredentials(rest)
}

export async function hasToken(): Promise<boolean> {
	const token = await loadToken()
	return token !== null
}

export function getCredentialsPath(): string {
	return CREDENTIALS_FILE
}
