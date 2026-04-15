import http from "http"
import { URL } from "url"

/**
 * Result from the local auth server callback.
 */
export interface LocalAuthResult {
	code: string
	state: string
	organizationId: string | null
	providerModel: string | null
}

/**
 * A temporary local HTTP server that listens for OAuth callbacks.
 *
 * On Linux desktop environments (e.g., xfce4, some Wayland compositors),
 * the `vscode://` custom URI scheme often doesn't work because the desktop
 * environment doesn't register it properly. This server provides an alternative
 * callback mechanism using `http://127.0.0.1:PORT` which works universally.
 *
 * The server:
 * - Listens on a random available port on 127.0.0.1
 * - Waits for a single GET request to /auth/clerk/callback
 * - Extracts code, state, organizationId, and provider_model from query params
 * - Responds with a success HTML page that the user sees in their browser
 * - Resolves the promise with the extracted parameters
 * - Automatically shuts down after receiving the callback or timing out
 */
export class LocalAuthServer {
	private server: http.Server | null = null
	private port: number | null = null
	private timeoutHandle: ReturnType<typeof setTimeout> | null = null

	/**
	 * Start the local server and return the port it's listening on.
	 *
	 * @returns The port number the server is listening on
	 */
	async start(): Promise<number> {
		return new Promise<number>((resolve, reject) => {
			this.server = http.createServer()

			this.server.on("error", (err) => {
				reject(err)
			})

			// Listen on a random available port on loopback only
			this.server.listen(0, "127.0.0.1", () => {
				const address = this.server?.address()

				if (address && typeof address === "object") {
					this.port = address.port
					resolve(this.port)
				} else {
					reject(new Error("Failed to get server address"))
				}
			})
		})
	}

	/**
	 * Wait for the auth callback to arrive.
	 *
	 * @param timeoutMs Maximum time to wait for the callback (default: 5 minutes)
	 * @returns The auth result with code, state, organizationId, and providerModel
	 */
	waitForCallback(timeoutMs: number = 300_000): Promise<LocalAuthResult> {
		return new Promise<LocalAuthResult>((resolve, reject) => {
			if (!this.server) {
				reject(new Error("Server not started"))
				return
			}

			this.timeoutHandle = setTimeout(() => {
				reject(new Error("Authentication timed out waiting for callback"))
				this.stop()
			}, timeoutMs)

			this.server.on("request", (req: http.IncomingMessage, res: http.ServerResponse) => {
				// Only handle GET requests to /auth/clerk/callback
				const requestUrl = new URL(req.url || "/", `http://127.0.0.1:${this.port}`)

				if (req.method !== "GET" || requestUrl.pathname !== "/auth/clerk/callback") {
					res.writeHead(404, { "Content-Type": "text/plain" })
					res.end("Not Found")
					return
				}

				const code = requestUrl.searchParams.get("code")
				const state = requestUrl.searchParams.get("state")
				const organizationId = requestUrl.searchParams.get("organizationId")
				const providerModel = requestUrl.searchParams.get("provider_model")

				// Respond with a success page regardless - the user sees this in their browser
				res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
				res.end(this.getSuccessHtml())

				if (this.timeoutHandle) {
					clearTimeout(this.timeoutHandle)
					this.timeoutHandle = null
				}

				if (!code || !state) {
					reject(new Error("Missing code or state in callback"))
				} else {
					resolve({
						code,
						state,
						organizationId: organizationId === "null" ? null : organizationId,
						providerModel: providerModel || null,
					})
				}

				// Shut down after handling the callback
				this.stop()
			})
		})
	}

	/**
	 * Get the base URL for the local server (e.g., "http://127.0.0.1:12345").
	 */
	getRedirectUrl(): string {
		if (!this.port) {
			throw new Error("Server not started")
		}

		return `http://127.0.0.1:${this.port}`
	}

	/**
	 * Stop the server and clean up resources.
	 */
	stop(): void {
		if (this.timeoutHandle) {
			clearTimeout(this.timeoutHandle)
			this.timeoutHandle = null
		}

		if (this.server) {
			this.server.close()
			this.server = null
		}

		this.port = null
	}

	private getSuccessHtml(): string {
		return `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Roo Code - Authentication Successful</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			margin: 0;
			background: #1e1e1e;
			color: #cccccc;
		}
		.container {
			text-align: center;
			padding: 2rem;
		}
		h1 { color: #4ec9b0; margin-bottom: 0.5rem; }
		p { font-size: 1.1rem; line-height: 1.6; }
	</style>
</head>
<body>
	<div class="container">
		<h1>Authentication Successful</h1>
		<p>You can close this tab and return to your editor.</p>
		<p>Roo Code is completing your sign-in.</p>
	</div>
</body>
</html>`
	}
}
