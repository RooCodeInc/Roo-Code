import {
	generateCodeVerifier,
	generateCodeChallenge,
	generateState,
	generateUserId,
	buildAuthorizationUrl,
	isTokenExpired,
	refreshAccessToken,
	CLAUDE_CODE_OAUTH_CONFIG,
	ClaudeCodeOAuthManager,
	type ClaudeCodeCredentials,
} from "../oauth"

// Mock vscode module
vi.mock("vscode", () => ({
	window: {
		showWarningMessage: vi.fn(),
	},
}))

// Mock fetch for token refresh tests
global.fetch = vi.fn()

describe("Claude Code OAuth", () => {
	describe("generateCodeVerifier", () => {
		test("should generate a base64url encoded verifier", () => {
			const verifier = generateCodeVerifier()
			// Base64url encoded 32 bytes = 43 characters
			expect(verifier).toHaveLength(43)
			// Should only contain base64url safe characters
			expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
		})

		test("should generate unique verifiers on each call", () => {
			const verifier1 = generateCodeVerifier()
			const verifier2 = generateCodeVerifier()
			expect(verifier1).not.toBe(verifier2)
		})
	})

	describe("generateCodeChallenge", () => {
		test("should generate a base64url encoded SHA256 hash", () => {
			const verifier = "test-verifier-string"
			const challenge = generateCodeChallenge(verifier)
			// Base64url encoded SHA256 hash = 43 characters
			expect(challenge).toHaveLength(43)
			// Should only contain base64url safe characters
			expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/)
		})

		test("should generate consistent challenge for same verifier", () => {
			const verifier = "test-verifier-string"
			const challenge1 = generateCodeChallenge(verifier)
			const challenge2 = generateCodeChallenge(verifier)
			expect(challenge1).toBe(challenge2)
		})

		test("should generate different challenges for different verifiers", () => {
			const challenge1 = generateCodeChallenge("verifier1")
			const challenge2 = generateCodeChallenge("verifier2")
			expect(challenge1).not.toBe(challenge2)
		})
	})

	describe("generateState", () => {
		test("should generate a 32-character hex string", () => {
			const state = generateState()
			expect(state).toHaveLength(32) // 16 bytes = 32 hex chars
			expect(state).toMatch(/^[0-9a-f]+$/)
		})

		test("should generate unique states on each call", () => {
			const state1 = generateState()
			const state2 = generateState()
			expect(state1).not.toBe(state2)
		})
	})

	describe("generateUserId", () => {
		test("should generate user ID with correct format", () => {
			const userId = generateUserId()
			// Format: user_<16 hex>_account_<32 hex>_session_<32 hex>
			expect(userId).toMatch(/^user_[0-9a-f]{16}_account_[0-9a-f]{32}_session_[0-9a-f]{32}$/)
		})

		test("should generate unique session IDs on each call", () => {
			const userId1 = generateUserId()
			const userId2 = generateUserId()
			// Full IDs should be different due to random session UUID
			expect(userId1).not.toBe(userId2)
		})

		test("should generate deterministic user hash and account UUID from email", () => {
			const email = "test@example.com"
			const userId1 = generateUserId(email)
			const userId2 = generateUserId(email)

			// Extract user and account parts (everything except session)
			const userAccount1 = userId1.replace(/_session_[0-9a-f]{32}$/, "")
			const userAccount2 = userId2.replace(/_session_[0-9a-f]{32}$/, "")

			// User hash and account UUID should be deterministic for same email
			expect(userAccount1).toBe(userAccount2)

			// But session UUID should be different
			const session1 = userId1.match(/_session_([0-9a-f]{32})$/)?.[1]
			const session2 = userId2.match(/_session_([0-9a-f]{32})$/)?.[1]
			expect(session1).not.toBe(session2)
		})

		test("should generate different user hash for different emails", () => {
			const userId1 = generateUserId("user1@example.com")
			const userId2 = generateUserId("user2@example.com")

			const userHash1 = userId1.match(/^user_([0-9a-f]{16})_/)?.[1]
			const userHash2 = userId2.match(/^user_([0-9a-f]{16})_/)?.[1]

			expect(userHash1).not.toBe(userHash2)
		})

		test("should generate random user hash and account UUID without email", () => {
			const userId1 = generateUserId()
			const userId2 = generateUserId()

			// Without email, even user hash should be different each call
			const userHash1 = userId1.match(/^user_([0-9a-f]{16})_/)?.[1]
			const userHash2 = userId2.match(/^user_([0-9a-f]{16})_/)?.[1]

			// Extremely unlikely to be the same (random 8 bytes)
			expect(userHash1).not.toBe(userHash2)
		})
	})

	describe("buildAuthorizationUrl", () => {
		test("should build correct authorization URL with all parameters", () => {
			const codeChallenge = "test-code-challenge"
			const state = "test-state"
			const url = buildAuthorizationUrl(codeChallenge, state)

			const parsedUrl = new URL(url)
			expect(parsedUrl.origin + parsedUrl.pathname).toBe(CLAUDE_CODE_OAUTH_CONFIG.authorizationEndpoint)

			const params = parsedUrl.searchParams
			expect(params.get("client_id")).toBe(CLAUDE_CODE_OAUTH_CONFIG.clientId)
			expect(params.get("redirect_uri")).toBe(CLAUDE_CODE_OAUTH_CONFIG.redirectUri)
			expect(params.get("scope")).toBe(CLAUDE_CODE_OAUTH_CONFIG.scopes)
			expect(params.get("code_challenge")).toBe(codeChallenge)
			expect(params.get("code_challenge_method")).toBe("S256")
			expect(params.get("response_type")).toBe("code")
			expect(params.get("state")).toBe(state)
		})
	})

	describe("isTokenExpired", () => {
		test("should return false for non-expired token", () => {
			const futureDate = new Date(Date.now() + 60 * 60 * 1000) // 1 hour in future
			const credentials: ClaudeCodeCredentials = {
				type: "claude",
				access_token: "test-token",
				refresh_token: "test-refresh",
				expired: futureDate.toISOString(),
			}
			expect(isTokenExpired(credentials)).toBe(false)
		})

		test("should return true for expired token", () => {
			const pastDate = new Date(Date.now() - 60 * 60 * 1000) // 1 hour in past
			const credentials: ClaudeCodeCredentials = {
				type: "claude",
				access_token: "test-token",
				refresh_token: "test-refresh",
				expired: pastDate.toISOString(),
			}
			expect(isTokenExpired(credentials)).toBe(true)
		})

		test("should return true for token expiring within 5 minute buffer", () => {
			const almostExpired = new Date(Date.now() + 3 * 60 * 1000) // 3 minutes in future (within 5 min buffer)
			const credentials: ClaudeCodeCredentials = {
				type: "claude",
				access_token: "test-token",
				refresh_token: "test-refresh",
				expired: almostExpired.toISOString(),
			}
			expect(isTokenExpired(credentials)).toBe(true)
		})

		test("should return false for token expiring after 5 minute buffer", () => {
			const notYetExpiring = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes in future
			const credentials: ClaudeCodeCredentials = {
				type: "claude",
				access_token: "test-token",
				refresh_token: "test-refresh",
				expired: notYetExpiring.toISOString(),
			}
			expect(isTokenExpired(credentials)).toBe(false)
		})
	})

	describe("CLAUDE_CODE_OAUTH_CONFIG", () => {
		test("should have correct configuration values", () => {
			expect(CLAUDE_CODE_OAUTH_CONFIG.authorizationEndpoint).toBe("https://claude.ai/oauth/authorize")
			expect(CLAUDE_CODE_OAUTH_CONFIG.tokenEndpoint).toBe("https://console.anthropic.com/v1/oauth/token")
			expect(CLAUDE_CODE_OAUTH_CONFIG.clientId).toBe("9d1c250a-e61b-44d9-88ed-5944d1962f5e")
			expect(CLAUDE_CODE_OAUTH_CONFIG.redirectUri).toBe("http://localhost:54545/callback")
			expect(CLAUDE_CODE_OAUTH_CONFIG.scopes).toBe("org:create_api_key user:profile user:inference")
			expect(CLAUDE_CODE_OAUTH_CONFIG.callbackPort).toBe(54545)
		})
	})

	describe("refreshAccessToken", () => {
		beforeEach(() => {
			vi.clearAllMocks()
		})

		test("should successfully refresh token", async () => {
			const mockResponse = {
				access_token: "new-access-token",
				refresh_token: "new-refresh-token",
				expires_in: 3600,
				email: "test@example.com",
			}

			;(global.fetch as any).mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			})

			const credentials = await refreshAccessToken("old-refresh-token")

			expect(credentials.access_token).toBe("new-access-token")
			expect(credentials.refresh_token).toBe("new-refresh-token")
			expect(credentials.email).toBe("test@example.com")
			expect(credentials.type).toBe("claude")
			expect(new Date(credentials.expired).getTime()).toBeGreaterThan(Date.now())
		})

		test("should throw error on failed refresh", async () => {
			;(global.fetch as any).mockResolvedValue({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
				text: async () => "Invalid refresh token",
			})

			await expect(refreshAccessToken("invalid-refresh-token")).rejects.toThrow(
				/Token refresh failed.*401.*Unauthorized/,
			)
		})
	})

	describe("ClaudeCodeOAuthManager", () => {
		let manager: ClaudeCodeOAuthManager
		let mockContext: any

		beforeEach(() => {
			vi.clearAllMocks()
			manager = new ClaudeCodeOAuthManager()
			mockContext = {
				secrets: {
					get: vi.fn(),
					store: vi.fn(),
					delete: vi.fn(),
				},
			}
		})

		afterEach(() => {
			manager.dispose()
		})

		describe("initialize", () => {
			test("should initialize without credentials", async () => {
				mockContext.secrets.get.mockResolvedValue(null)

				await manager.initialize(mockContext)

				expect(mockContext.secrets.get).toHaveBeenCalled()
			})

			test("should load and start refresh timer with existing credentials", async () => {
				const futureDate = new Date(Date.now() + 60 * 60 * 1000)
				const credentials: ClaudeCodeCredentials = {
					type: "claude",
					access_token: "test-token",
					refresh_token: "test-refresh",
					expired: futureDate.toISOString(),
				}

				mockContext.secrets.get.mockResolvedValue(JSON.stringify(credentials))

				await manager.initialize(mockContext)

				// Credentials should be loaded
				expect(manager.getCredentials()).toMatchObject(credentials)
			})
		})

		describe("getAccessToken", () => {
			test("should return null when not authenticated", async () => {
				mockContext.secrets.get.mockResolvedValue(null)
				await manager.initialize(mockContext)

				const token = await manager.getAccessToken()

				expect(token).toBeNull()
			})

			test("should return existing valid token", async () => {
				const futureDate = new Date(Date.now() + 60 * 60 * 1000)
				const credentials: ClaudeCodeCredentials = {
					type: "claude",
					access_token: "valid-token",
					refresh_token: "test-refresh",
					expired: futureDate.toISOString(),
				}

				mockContext.secrets.get.mockResolvedValue(JSON.stringify(credentials))
				await manager.initialize(mockContext)

				const token = await manager.getAccessToken()

				expect(token).toBe("valid-token")
			})

			test("should refresh expired token automatically", async () => {
				const pastDate = new Date(Date.now() - 60 * 60 * 1000)
				const credentials: ClaudeCodeCredentials = {
					type: "claude",
					access_token: "expired-token",
					refresh_token: "test-refresh",
					expired: pastDate.toISOString(),
				}

				mockContext.secrets.get.mockResolvedValue(JSON.stringify(credentials))

				const mockResponse = {
					access_token: "new-token",
					refresh_token: "new-refresh",
					expires_in: 3600,
				}

				;(global.fetch as any).mockResolvedValue({
					ok: true,
					json: async () => mockResponse,
				})

				await manager.initialize(mockContext)

				const token = await manager.getAccessToken()

				expect(token).toBe("new-token")
				expect(mockContext.secrets.store).toHaveBeenCalled()
			})
		})

		describe("saveCredentials", () => {
			test("should save credentials and start refresh timer", async () => {
				await manager.initialize(mockContext)

				const credentials: ClaudeCodeCredentials = {
					type: "claude",
					access_token: "new-token",
					refresh_token: "new-refresh",
					expired: new Date(Date.now() + 3600 * 1000).toISOString(),
				}

				await manager.saveCredentials(credentials)

				expect(mockContext.secrets.store).toHaveBeenCalledWith(
					"claude-code-oauth-credentials",
					JSON.stringify(credentials),
				)
				expect(manager.getCredentials()).toMatchObject(credentials)
			})
		})

		describe("clearCredentials", () => {
			test("should clear credentials and stop refresh timer", async () => {
				const credentials: ClaudeCodeCredentials = {
					type: "claude",
					access_token: "test-token",
					refresh_token: "test-refresh",
					expired: new Date(Date.now() + 3600 * 1000).toISOString(),
				}

				mockContext.secrets.get.mockResolvedValue(JSON.stringify(credentials))
				await manager.initialize(mockContext)

				await manager.clearCredentials()

				expect(mockContext.secrets.delete).toHaveBeenCalled()
				expect(manager.getCredentials()).toBeNull()
			})
		})

		describe("isAuthenticated", () => {
			test("should return false when no credentials", async () => {
				mockContext.secrets.get.mockResolvedValue(null)
				await manager.initialize(mockContext)

				const isAuth = await manager.isAuthenticated()

				expect(isAuth).toBe(false)
			})

			test("should return true with valid credentials", async () => {
				const futureDate = new Date(Date.now() + 60 * 60 * 1000)
				const credentials: ClaudeCodeCredentials = {
					type: "claude",
					access_token: "valid-token",
					refresh_token: "test-refresh",
					expired: futureDate.toISOString(),
				}

				mockContext.secrets.get.mockResolvedValue(JSON.stringify(credentials))
				await manager.initialize(mockContext)

				const isAuth = await manager.isAuthenticated()

				expect(isAuth).toBe(true)
			})
		})

		describe("dispose", () => {
			test("should stop refresh timer and cancel auth flow", async () => {
				const credentials: ClaudeCodeCredentials = {
					type: "claude",
					access_token: "test-token",
					refresh_token: "test-refresh",
					expired: new Date(Date.now() + 3600 * 1000).toISOString(),
				}

				mockContext.secrets.get.mockResolvedValue(JSON.stringify(credentials))
				await manager.initialize(mockContext)

				// Should not throw
				manager.dispose()

				// Calling dispose multiple times should be safe
				manager.dispose()
			})
		})
	})
})
