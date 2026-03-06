import * as http from "http"

export interface CallbackResult {
	code?: string
	error?: string
	error_description?: string
	state?: string
}

/**
 * Starts a local HTTP server to handle OAuth callback.
 * @param port Optional port to use (defaults to random available port)
 * @param expectedState Optional expected state for CSRF protection
 * @returns Promise<{server: http.Server, port: number, result: Promise<CallbackResult>}>
 */
export function startCallbackServer(
	port?: number,
	expectedState?: string,
): Promise<{
	server: http.Server
	port: number
	result: Promise<CallbackResult>
}> {
	// In test mode, immediately resolve with mock data
	if (process.env.MCP_OAUTH_TEST_MODE === "true") {
		return new Promise((resolve) => {
			const mockServer = http.createServer()
			resolve({
				server: mockServer,
				port: 3000,
				result: Promise.resolve({ code: "test-auth-code", state: expectedState }),
			})
		})
	}

	return new Promise((resolve, reject) => {
		const server = http.createServer()

		server.listen(port || 0, "127.0.0.1", () => {
			const address = server.address()
			if (!address || typeof address === "string") {
				reject(new Error("Failed to get server address"))
				return
			}

			const actualPort = address.port

			const resultPromise = new Promise<CallbackResult>((resolveResult, rejectResult) => {
				let resolved = false

				const timeout = setTimeout(
					() => {
						if (!resolved) {
							resolved = true
							rejectResult(new Error("Callback timeout"))
							server.close()
						}
					},
					5 * 60 * 1000,
				) // 5 minutes

				server.on("request", (req: any, res: any) => {
					if (resolved) return

					const url = new URL(req.url || "", `http://localhost:${actualPort}`)
					const pathname = url.pathname

					if (pathname === "/callback") {
						resolved = true
						clearTimeout(timeout)

						const code = url.searchParams.get("code")
						const error = url.searchParams.get("error")
						const errorDescription = url.searchParams.get("error_description")
						const state = url.searchParams.get("state")

						// Verify state for CSRF protection
						if (expectedState && state !== expectedState) {
							res.writeHead(400, { "Content-Type": "text/html" })
							res.end(`
                <!DOCTYPE html>
                <html>
                  <head>
                    <title>OAuth Callback</title>
                  </head>
                  <body>
                    <h1>OAuth Authentication Failed</h1>
                    <p>Error: Invalid state parameter</p>
                  </body>
                </html>
              `)
							rejectResult(new Error("Invalid state parameter"))
							return
						}

						// Send HTML response
						res.writeHead(200, { "Content-Type": "text/html" })
						res.end(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>OAuth Callback</title>
                </head>
                <body>
                  <h1>OAuth Authentication ${error ? "Failed" : "Successful"}</h1>
                  <p>
                    ${error ? `Error: ${error}${errorDescription ? ` - ${errorDescription}` : ""}` : "You can close this window."}
                  </p>
                </body>
              </html>
            `)

						resolveResult({
							code: code || undefined,
							error: error || undefined,
							error_description: errorDescription || undefined,
							state: state || undefined,
						})

						// Close server after a short delay to allow response to be sent
						setTimeout(() => server.close(), 1000)
					} else {
						res.writeHead(404)
						res.end("Not found")
					}
				})

				server.on("error", (error: any) => {
					if (!resolved) {
						resolved = true
						clearTimeout(timeout)
						rejectResult(error)
					}
				})
			})

			resolve({
				server,
				port: actualPort,
				result: resultPromise,
			})
		})

		server.on("error", reject)
	})
}

/**
 * Stops the callback server.
 * @param server The HTTP server to stop
 */
export function stopCallbackServer(server: http.Server): Promise<void> {
	return new Promise((resolve) => {
		server.close(() => resolve())
	})
}
