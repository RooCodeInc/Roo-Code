import fs from "fs/promises"
import path from "path"
import os from "os"

import {
	saveOpenAiCodexCredentials,
	loadOpenAiCodexCredentials,
	clearOpenAiCodexCredentials,
	hasOpenAiCodexCredentials,
	isCredentialsExpired,
	type OpenAiCodexCredentials,
} from "../openai-codex-credentials.js"

// Override the HOME env to use a temp directory for tests
const testDir = path.join(os.tmpdir(), `roo-cli-codex-test-${Date.now()}`)
const originalHome = process.env.HOME

beforeAll(() => {
	process.env.HOME = testDir
})

afterAll(async () => {
	process.env.HOME = originalHome
	await fs.rm(testDir, { recursive: true, force: true })
})

beforeEach(async () => {
	// Clean secrets between tests
	const secretsPath = path.join(testDir, ".vscode-mock", "global-storage", "secrets.json")
	try {
		await fs.unlink(secretsPath)
	} catch {
		// file may not exist
	}
})

const validCredentials: OpenAiCodexCredentials = {
	type: "openai-codex",
	access_token: "test-access-token",
	refresh_token: "test-refresh-token",
	expires: Date.now() + 3600 * 1000,
	email: "test@example.com",
	accountId: "acct_123",
}

describe("OpenAI Codex Credentials Storage", () => {
	describe("saveOpenAiCodexCredentials", () => {
		it("should save credentials to secrets file", async () => {
			await saveOpenAiCodexCredentials(validCredentials)

			const secretsPath = path.join(testDir, ".vscode-mock", "global-storage", "secrets.json")
			const raw = await fs.readFile(secretsPath, "utf-8")
			const secrets = JSON.parse(raw)

			expect(secrets["openai-codex-oauth-credentials"]).toBeDefined()
			const stored = JSON.parse(secrets["openai-codex-oauth-credentials"])
			expect(stored.type).toBe("openai-codex")
			expect(stored.access_token).toBe("test-access-token")
			expect(stored.refresh_token).toBe("test-refresh-token")
		})

		it("should create directory structure if it doesn't exist", async () => {
			await saveOpenAiCodexCredentials(validCredentials)

			const dirPath = path.join(testDir, ".vscode-mock", "global-storage")
			const stats = await fs.stat(dirPath)
			expect(stats.isDirectory()).toBe(true)
		})
	})

	describe("loadOpenAiCodexCredentials", () => {
		it("should load saved credentials", async () => {
			await saveOpenAiCodexCredentials(validCredentials)

			const loaded = await loadOpenAiCodexCredentials()

			expect(loaded).not.toBeNull()
			expect(loaded!.type).toBe("openai-codex")
			expect(loaded!.access_token).toBe("test-access-token")
			expect(loaded!.refresh_token).toBe("test-refresh-token")
			expect(loaded!.email).toBe("test@example.com")
			expect(loaded!.accountId).toBe("acct_123")
		})

		it("should return null when no credentials exist", async () => {
			const loaded = await loadOpenAiCodexCredentials()
			expect(loaded).toBeNull()
		})

		it("should return null for invalid credentials data", async () => {
			const secretsPath = path.join(testDir, ".vscode-mock", "global-storage", "secrets.json")
			await fs.mkdir(path.dirname(secretsPath), { recursive: true })
			await fs.writeFile(secretsPath, JSON.stringify({ "openai-codex-oauth-credentials": "invalid-json" }))

			const loaded = await loadOpenAiCodexCredentials()
			expect(loaded).toBeNull()
		})
	})

	describe("clearOpenAiCodexCredentials", () => {
		it("should remove credentials", async () => {
			await saveOpenAiCodexCredentials(validCredentials)
			expect(await hasOpenAiCodexCredentials()).toBe(true)

			await clearOpenAiCodexCredentials()
			expect(await hasOpenAiCodexCredentials()).toBe(false)
		})

		it("should not throw when no credentials exist", async () => {
			await expect(clearOpenAiCodexCredentials()).resolves.not.toThrow()
		})
	})

	describe("hasOpenAiCodexCredentials", () => {
		it("should return false when no credentials exist", async () => {
			expect(await hasOpenAiCodexCredentials()).toBe(false)
		})

		it("should return true when credentials exist", async () => {
			await saveOpenAiCodexCredentials(validCredentials)
			expect(await hasOpenAiCodexCredentials()).toBe(true)
		})
	})

	describe("isCredentialsExpired", () => {
		it("should return false for unexpired credentials", () => {
			const creds: OpenAiCodexCredentials = {
				...validCredentials,
				expires: Date.now() + 60 * 60 * 1000, // 1 hour from now
			}
			expect(isCredentialsExpired(creds)).toBe(false)
		})

		it("should return true for expired credentials", () => {
			const creds: OpenAiCodexCredentials = {
				...validCredentials,
				expires: Date.now() - 1000, // already expired
			}
			expect(isCredentialsExpired(creds)).toBe(true)
		})

		it("should return true when within 5-minute buffer", () => {
			const creds: OpenAiCodexCredentials = {
				...validCredentials,
				expires: Date.now() + 2 * 60 * 1000, // 2 minutes from now (within 5 min buffer)
			}
			expect(isCredentialsExpired(creds)).toBe(true)
		})
	})
})
