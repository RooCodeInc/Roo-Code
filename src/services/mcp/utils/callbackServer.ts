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
    <title>OAuth Callback - Roo Code</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 50px auto; text-align: center; padding: 20px; }
      h1 { color: #28a745; }
      .error h1 { color: #dc3545; }
      .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #28a745; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      button { background: #007acc; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 16px; }
      .countdown { font-size: 18px; margin: 10px 0; }
    </style>
  </head>
  <body>
    <h1 id="title">${error ? "Failed" : "Success!"}</h1>
    <div class="spinner" id="spinner" style="${error ? "display:none;" : ""}"></div>
    <p id="message">
      ${
			error
				? "Authentication failed. Please check the MCP server logs."
				: "MCP server authenticated successfully. You can now close this browser tab."
		}
    </p>
    <div id="countdown" class="countdown" style="${error ? "display:none;" : ""}">The server connection is complete.</div>
    <script>
      const isError = ${error ? "true" : "false"};
      if (!isError) {
        let count = 5;
        const countEl = document.getElementById('count');
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) {
          countdownEl.innerHTML = 'This tab will attempt to close in <span id="count">5</span>s...';
        }
        const timer = setInterval(() => {
          count--;
          const currentCountEl = document.getElementById('count');
          if (currentCountEl) currentCountEl.textContent = count;
          if (count <= 0) {
            clearInterval(timer);
            window.close();
            if (countdownEl) {
               countdownEl.textContent = 'If the tab did not close, you can safely close it manually.';
            }
          }
        }, 1000);
      }
    </script>
  </body>
</html>
            `)

						resolveResult({
							code: code || undefined,
							error: error || undefined,
							error_description: errorDescription || undefined,
							state: state || undefined,
						})

						// Close server immediately after response drains
						res.on("finish", () => {
							server.close()
						})
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
