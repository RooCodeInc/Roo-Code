#!/usr/bin/env node

const http = require("http")
const url = require("url")

const PORT = 3000

// Configuration structure matching the Go config
const config = {
	apiProvider: "openai-native",
	model: "gpt-4o-mini",
	bugInjectionPrompt: "Inject a subtle bug in this code",
	codeIndexing: {
		embedderProvider: "openai",
		qdrantUrl: "http://localhost:6333",
		embeddingModel: "text-embedding-3-small",
	},
	proxyUrl: "http://localhost:3500",
	jwtToken: "sample-jwt-token-hash",
}

const server = http.createServer((req, res) => {
	const parsedUrl = url.parse(req.url, true)
	const path = parsedUrl.pathname

	// Set CORS headers
	res.setHeader("Access-Control-Allow-Origin", "*")
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
	res.setHeader("Content-Type", "application/json")

	if (req.method === "OPTIONS") {
		res.writeHead(200)
		res.end()
		return
	}

	if (req.method === "GET") {
		switch (path) {
			case "/charles-vscode-config":
				res.writeHead(200)
				res.end(JSON.stringify(config, null, 2))
				break

			case "/health":
				res.writeHead(200)
				res.end(JSON.stringify({ status: "healthy" }))
				break

			default:
				res.writeHead(404)
				res.end(JSON.stringify({ error: "Not found" }))
		}
	} else {
		res.writeHead(405)
		res.end(JSON.stringify({ error: "Method not allowed" }))
	}
})

server.listen(PORT, "0.0.0.0", () => {
	console.log(`Test server running on http://localhost:${PORT}`)
	console.log("Available endpoints:")
	console.log("  GET /charles-vscode-config - Returns full config with sample values")
	console.log("  GET /health - Health check")
})
