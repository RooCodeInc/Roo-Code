import http from "http"
import https from "https"
import { randomBytes } from "crypto"
import net from "net"
import { exec } from "child_process"

import { AUTH_BASE_URL } from "@/types/index.js"
import { saveToken } from "@/lib/storage/index.js"

export interface LoginOptions {
	timeout?: number
	verbose?: boolean
	useDeviceCode?: boolean
}

export type LoginResult =
	| {
			success: true
			token: string
	  }
	| {
			success: false
			error: string
	  }

export interface DeviceCodeResponse {
	device_code: string
	user_code: string
	verification_uri: string
	expires_in: number
	interval: number
}

export interface DeviceCodePollResponse {
	status: "pending" | "complete" | "expired"
	token?: string
}

const LOCALHOST = "127.0.0.1"

export async function login({
	timeout = 5 * 60 * 1000,
	verbose = false,
	useDeviceCode = false,
}: LoginOptions = {}): Promise<LoginResult> {
	if (useDeviceCode) {
		return deviceCodeLogin({ timeout, verbose })
	}
	return browserCallbackLogin({ timeout, verbose })
}

/**
 * Device code authentication flow, similar to GitHub CLI's device code flow.
 * This works on remote/headless servers where a local browser callback is not feasible.
 *
 * Flow:
 * 1. Request a device code from the auth server
 * 2. Display the verification URL and user code to the user
 * 3. User opens the URL on any device and enters the code
 * 4. CLI polls the server until authentication is complete
 */
export async function deviceCodeLogin({
	timeout = 5 * 60 * 1000,
	verbose = false,
}: Omit<LoginOptions, "useDeviceCode"> = {}): Promise<LoginResult> {
	if (verbose) {
		console.log("[Auth] Starting device code authentication flow")
	}

	try {
		// Step 1: Request a device code from the auth server.
		const deviceCodeUrl = `${AUTH_BASE_URL}/api/cli/device-code`

		if (verbose) {
			console.log(`[Auth] Requesting device code from ${deviceCodeUrl}`)
		}

		const deviceCodeResponse = await httpPost<DeviceCodeResponse>(deviceCodeUrl)

		const { device_code, user_code, verification_uri, expires_in, interval } = deviceCodeResponse

		// Step 2: Display instructions to the user.
		console.log("")
		console.log("To authenticate, open the following URL in a browser on any device:")
		console.log("")
		console.log(`  ${verification_uri}`)
		console.log("")
		console.log(`Then enter this code: ${user_code}`)
		console.log("")
		console.log("Waiting for authentication...")

		// Step 3: Poll for completion.
		const pollUrl = `${AUTH_BASE_URL}/api/cli/device-code/poll`
		const pollInterval = (interval || 5) * 1000
		const expiresAt = Date.now() + Math.min(expires_in * 1000, timeout)

		const token = await pollForToken({
			pollUrl,
			deviceCode: device_code,
			pollInterval,
			expiresAt,
			verbose,
		})

		// Step 4: Save and return.
		await saveToken(token)
		console.log("✓ Successfully authenticated!")
		return { success: true, token }
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error(`✗ Authentication failed: ${message}`)
		return { success: false, error: message }
	}
}

interface PollOptions {
	pollUrl: string
	deviceCode: string
	pollInterval: number
	expiresAt: number
	verbose: boolean
}

export async function pollForToken({
	pollUrl,
	deviceCode,
	pollInterval,
	expiresAt,
	verbose,
}: PollOptions): Promise<string> {
	while (Date.now() < expiresAt) {
		await sleep(pollInterval)

		if (verbose) {
			console.log("[Auth] Polling for authentication result...")
		}

		try {
			const response = await httpPost<DeviceCodePollResponse>(pollUrl, { device_code: deviceCode })

			if (response.status === "complete" && response.token) {
				return response.token
			}

			if (response.status === "expired") {
				throw new Error("Device code expired. Please try again.")
			}

			// status === "pending", continue polling
		} catch (error) {
			// If it's a known error (expired, etc.), rethrow
			if (error instanceof Error && error.message.includes("expired")) {
				throw error
			}

			if (verbose) {
				console.warn("[Auth] Poll request failed, retrying:", error)
			}
		}
	}

	throw new Error("Authentication timed out. Please try again.")
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Simple HTTP POST helper that works with both http and https.
 */
export function httpPost<T>(url: string, body?: Record<string, string>): Promise<T> {
	return new Promise((resolve, reject) => {
		const parsedUrl = new URL(url)
		const isHttps = parsedUrl.protocol === "https:"
		const transport = isHttps ? https : http

		const postData = body ? JSON.stringify(body) : ""

		const options = {
			hostname: parsedUrl.hostname,
			port: parsedUrl.port || (isHttps ? 443 : 80),
			path: parsedUrl.pathname + parsedUrl.search,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Content-Length": Buffer.byteLength(postData),
			},
		}

		const req = transport.request(options, (res) => {
			let data = ""

			res.on("data", (chunk: Buffer | string) => {
				data += chunk
			})

			res.on("end", () => {
				if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
					try {
						resolve(JSON.parse(data) as T)
					} catch {
						reject(new Error(`Invalid JSON response: ${data}`))
					}
				} else {
					reject(new Error(`HTTP ${res.statusCode}: ${data}`))
				}
			})
		})

		req.on("error", reject)

		if (postData) {
			req.write(postData)
		}

		req.end()
	})
}

async function browserCallbackLogin({
	timeout = 5 * 60 * 1000,
	verbose = false,
}: Omit<LoginOptions, "useDeviceCode"> = {}): Promise<LoginResult> {
	const state = randomBytes(16).toString("hex")
	const port = await getAvailablePort()
	const host = `http://${LOCALHOST}:${port}`

	if (verbose) {
		console.log(`[Auth] Starting local callback server on port ${port}`)
	}

	// Create promise that will be resolved when we receive the callback.
	const tokenPromise = new Promise<{ token: string; state: string }>((resolve, reject) => {
		const server = http.createServer((req, res) => {
			const url = new URL(req.url!, host)

			if (url.pathname === "/callback") {
				const receivedState = url.searchParams.get("state")
				const token = url.searchParams.get("token")
				const error = url.searchParams.get("error")

				if (error) {
					const errorUrl = new URL(`${AUTH_BASE_URL}/cli/sign-in?error=error-in-callback`)
					errorUrl.searchParams.set("message", error)
					res.writeHead(302, { Location: errorUrl.toString() })
					res.end(() => {
						server.close()
						reject(new Error(error))
					})
				} else if (!token) {
					const errorUrl = new URL(`${AUTH_BASE_URL}/cli/sign-in?error=missing-token`)
					errorUrl.searchParams.set("message", "Missing token in callback")
					res.writeHead(302, { Location: errorUrl.toString() })
					res.end(() => {
						server.close()
						reject(new Error("Missing token in callback"))
					})
				} else if (receivedState !== state) {
					const errorUrl = new URL(`${AUTH_BASE_URL}/cli/sign-in?error=invalid-state-parameter`)
					errorUrl.searchParams.set("message", "Invalid state parameter")
					res.writeHead(302, { Location: errorUrl.toString() })
					res.end(() => {
						server.close()
						reject(new Error("Invalid state parameter"))
					})
				} else {
					res.writeHead(302, { Location: `${AUTH_BASE_URL}/cli/sign-in?success=true` })
					res.end(() => {
						server.close()
						resolve({ token, state: receivedState })
					})
				}
			} else {
				res.writeHead(404, { "Content-Type": "text/plain" })
				res.end("Not found")
			}
		})

		server.listen(port, LOCALHOST)

		const timeoutId = setTimeout(() => {
			server.close()
			reject(new Error("Authentication timed out"))
		}, timeout)

		server.on("close", () => {
			clearTimeout(timeoutId)
		})
	})

	const authUrl = new URL(`${AUTH_BASE_URL}/cli/sign-in`)
	authUrl.searchParams.set("state", state)
	authUrl.searchParams.set("callback", `${host}/callback`)

	console.log("Opening browser for authentication...")
	console.log(`If the browser doesn't open, visit: ${authUrl.toString()}`)

	try {
		await openBrowser(authUrl.toString())
	} catch (error) {
		if (verbose) {
			console.warn("[Auth] Failed to open browser automatically:", error)
		}

		console.log("Please open the URL above in your browser manually.")
	}

	try {
		const { token } = await tokenPromise
		await saveToken(token)
		console.log("✓ Successfully authenticated!")
		return { success: true, token }
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error(`✗ Authentication failed: ${message}`)
		return { success: false, error: message }
	}
}

async function getAvailablePort(startPort = 49152, endPort = 65535): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = net.createServer()
		let port = startPort

		const tryPort = () => {
			server.once("error", (err: NodeJS.ErrnoException) => {
				if (err.code === "EADDRINUSE" && port < endPort) {
					port++
					tryPort()
				} else {
					reject(err)
				}
			})

			server.once("listening", () => {
				server.close(() => {
					resolve(port)
				})
			})

			server.listen(port, LOCALHOST)
		}

		tryPort()
	})
}

function openBrowser(url: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const platform = process.platform
		let command: string

		switch (platform) {
			case "darwin":
				command = `open "${url}"`
				break
			case "win32":
				command = `start "" "${url}"`
				break
			default:
				// Linux and other Unix-like systems.
				command = `xdg-open "${url}"`
				break
		}

		exec(command, (error) => {
			if (error) {
				reject(error)
			} else {
				resolve()
			}
		})
	})
}
