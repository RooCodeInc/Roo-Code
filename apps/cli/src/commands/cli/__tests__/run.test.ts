import fs from "fs"
import path from "path"
import os from "os"

import type { User } from "@/lib/sdk/index.js"

import * as sdk from "@/lib/sdk/index.js"
import * as storage from "@/lib/storage/index.js"

import { assertAuthReady, assertNonInteractiveOAuthReady, resolveProviderAuthentication } from "../run.js"

describe("run auth helpers", () => {
	const originalEnv = process.env

	beforeEach(() => {
		process.env = { ...originalEnv }
		vi.restoreAllMocks()
		vi.spyOn(storage, "loadProviderApiKey").mockResolvedValue(null)
	})

	afterEach(() => {
		process.env = originalEnv
	})

	it("marks openai-codex auth as OAuth bootstrap without API key", async () => {
		const auth = await resolveProviderAuthentication({
			provider: "openai-codex",
			rooToken: null,
			settings: {},
			interactive: false,
		})

		expect(auth.needsOAuthBootstrap).toBe(true)
		expect(auth.apiKey).toBeUndefined()
	})

	it("keeps openai-native API key flow via OPENAI_API_KEY", async () => {
		process.env.OPENAI_API_KEY = "env-openai-key"

		const auth = await resolveProviderAuthentication({
			provider: "openai-native",
			rooToken: null,
			settings: {},
			interactive: false,
		})

		expect(auth.needsOAuthBootstrap).toBe(false)
		expect(auth.apiKey).toBe("env-openai-key")
	})

	it("authenticates roo provider with valid cloud token", async () => {
		const rooUser = { id: "user_1" } as User

		vi.spyOn(sdk, "createClient").mockReturnValue({
			auth: {
				me: {
					query: vi.fn().mockResolvedValue({ type: "user", user: rooUser }),
				},
			},
		} as ReturnType<typeof sdk.createClient>)

		const auth = await resolveProviderAuthentication({
			provider: "roo",
			rooToken: "valid-token",
			settings: {},
			interactive: true,
		})

		expect(auth.apiKey).toBe("valid-token")
		expect(auth.rooUser).toEqual(rooUser)
		expect(auth.invalidRooToken).toBeUndefined()
	})

	it("falls back when roo token is invalid", async () => {
		vi.spyOn(sdk, "createClient").mockReturnValue({
			auth: {
				me: {
					query: vi.fn().mockRejectedValue(new Error("invalid token")),
				},
			},
		} as ReturnType<typeof sdk.createClient>)
		vi.spyOn(storage, "loadProviderApiKey").mockResolvedValue("saved-roo-api-key")

		const auth = await resolveProviderAuthentication({
			provider: "roo",
			rooToken: "invalid-token",
			settings: {},
			interactive: true,
		})

		expect(auth.invalidRooToken).toBe(true)
		expect(auth.apiKey).toBe("saved-roo-api-key")
	})

	it("does not fail auth readiness for openai-codex without API key", async () => {
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
			throw new Error(`exit:${code}`)
		}) as never)

		await expect(
			assertAuthReady({
				provider: "openai-codex",
				auth: { needsOAuthBootstrap: true },
				interactive: false,
			}),
		).resolves.toBeUndefined()
		expect(exitSpy).not.toHaveBeenCalled()
	})

	it("still fails API-key providers without API key", async () => {
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
			throw new Error(`exit:${code}`)
		}) as never)
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		await expect(
			assertAuthReady({
				provider: "openai-native",
				auth: {},
				interactive: false,
			}),
		).rejects.toThrow("exit:1")

		expect(exitSpy).toHaveBeenCalledWith(1)
		expect(errorSpy).toHaveBeenCalledWith(
			"[CLI] Error: No API key provided. Use --api-key or set the appropriate environment variable.",
		)
		expect(errorSpy).toHaveBeenCalledWith("[CLI] For openai-native, set OPENAI_API_KEY")
	})

	it("fails fast for unauthenticated openai-codex in non-interactive mode", () => {
		expect(() =>
			assertNonInteractiveOAuthReady({
				provider: "openai-codex",
				interactive: false,
				providerAuthState: { openAiCodexIsAuthenticated: false },
			}),
		).toThrow(
			"openai-codex requires interactive OAuth. Run in TTY or pre-auth with roo auth login --provider openai-codex.",
		)
	})

	it("allows non-interactive openai-codex when already authenticated", () => {
		expect(() =>
			assertNonInteractiveOAuthReady({
				provider: "openai-codex",
				interactive: false,
				providerAuthState: { openAiCodexIsAuthenticated: true },
			}),
		).not.toThrow()
	})

	it("does not apply oauth fail-fast check to non-oauth providers", () => {
		expect(() =>
			assertNonInteractiveOAuthReady({
				provider: "openrouter",
				interactive: false,
				providerAuthState: {},
			}),
		).not.toThrow()
	})
})

describe("run command --prompt-file option", () => {
	let tempDir: string
	let promptFilePath: string

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"))
		promptFilePath = path.join(tempDir, "prompt.md")
	})

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true })
	})

	it("should read prompt from file when --prompt-file is provided", () => {
		const promptContent = `This is a test prompt with special characters:
- Quotes: "hello" and 'world'
- Backticks: \`code\`
- Newlines and tabs
- Unicode: 你好 🎉`

		fs.writeFileSync(promptFilePath, promptContent)

		// Verify the file was written correctly
		const readContent = fs.readFileSync(promptFilePath, "utf-8")
		expect(readContent).toBe(promptContent)
	})

	it("should handle multi-line prompts correctly", () => {
		const multiLinePrompt = `Line 1
Line 2
Line 3

Empty line above
\tTabbed line
  Indented line`

		fs.writeFileSync(promptFilePath, multiLinePrompt)
		const readContent = fs.readFileSync(promptFilePath, "utf-8")

		expect(readContent).toBe(multiLinePrompt)
		expect(readContent.split("\n")).toHaveLength(7)
	})

	it("should handle very long prompts that would exceed ARG_MAX", () => {
		// ARG_MAX is typically 128KB-2MB, so let's test with a 500KB prompt
		const longPrompt = "x".repeat(500 * 1024)

		fs.writeFileSync(promptFilePath, longPrompt)
		const readContent = fs.readFileSync(promptFilePath, "utf-8")

		expect(readContent.length).toBe(500 * 1024)
		expect(readContent).toBe(longPrompt)
	})

	it("should preserve shell-sensitive characters", () => {
		const shellSensitivePrompt = `
$HOME
$(echo dangerous)
\`rm -rf /\`
"quoted string"
'single quoted'
$((1+1))
&&
||
;
> /dev/null
< input.txt
| grep something
*
?
[abc]
{a,b}
~
!
#comment
%s
\n\t\r
`

		fs.writeFileSync(promptFilePath, shellSensitivePrompt)
		const readContent = fs.readFileSync(promptFilePath, "utf-8")

		// All shell-sensitive characters should be preserved exactly
		expect(readContent).toBe(shellSensitivePrompt)
		expect(readContent).toContain("$HOME")
		expect(readContent).toContain("$(echo dangerous)")
		expect(readContent).toContain("`rm -rf /`")
	})
})
