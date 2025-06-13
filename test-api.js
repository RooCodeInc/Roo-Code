#!/usr/bin/env node

/**
 * Test script for Roo Code Agent API Server
 * Usage: node test-api.js [options] "Your task here"
 *
 * Options:
 *   --stream    Test SSE streaming endpoint (default: false)
 *   --host      API host (default: localhost)
 *   --port      API port (default: 3000)
 *   --help      Show help
 */

const http = require("http")
const https = require("https")

// Parse command line arguments
const args = process.argv.slice(2)
let useStream = false
let host = "localhost"
let port = 3000
let task = "Test task from API client"
let showHelp = false

for (let i = 0; i < args.length; i++) {
	const arg = args[i]

	if (arg === "--stream") {
		useStream = true
	} else if (arg === "--host") {
		host = args[++i] || host
	} else if (arg === "--port") {
		port = parseInt(args[++i]) || port
	} else if (arg === "--help" || arg === "-h") {
		showHelp = true
	} else if (!arg.startsWith("--")) {
		task = arg
	}
}

if (showHelp) {
	console.log(`
🧪 Roo Code Agent API Test Client

Usage: node test-api.js [options] "Your task here"

Options:
  --stream    Test SSE streaming endpoint (default: false)
  --host      API host (default: localhost)
  --port      API port (default: 3000)
  --help      Show this help

Examples:
  node test-api.js --stream "where does the vscode extension code store it's mode config files?"
  node test-api.js --stream "list your MCP servers"
  node test-api.js --stream "Write a React component"
  node test-api.js --host api.example.com --port 8080 "Debug this code"
`)
	process.exit(0)
}

const baseUrl = `http://${host}:${port}`

console.log(`🚀 Testing Roo Code Agent API at ${baseUrl}`)
console.log(`📝 Task: "${task}"`)
console.log(`🌊 Streaming: ${useStream ? "enabled" : "disabled"}`)
console.log("")

/**
 * Make HTTP request helper
 */
function makeRequest(options, data = null) {
	return new Promise((resolve, reject) => {
		const protocol = options.protocol === "https:" ? https : http

		const req = protocol.request(options, (res) => {
			let body = ""

			res.on("data", (chunk) => {
				body += chunk
			})

			res.on("end", () => {
				resolve({
					statusCode: res.statusCode,
					headers: res.headers,
					body: body,
				})
			})
		})

		req.on("error", reject)

		if (data) {
			req.write(data)
		}

		req.end()
	})
}

/**
 * Test basic endpoints
 */
async function testBasicEndpoints() {
	console.log("🔍 Testing basic endpoints...\n")

	// Test health endpoint
	try {
		console.log("📊 GET /health")
		const healthResponse = await makeRequest({
			hostname: host,
			port: port,
			path: "/health",
			method: "GET",
			headers: { "Content-Type": "application/json" },
		})

		console.log(`   Status: ${healthResponse.statusCode}`)
		if (healthResponse.statusCode === 200) {
			const health = JSON.parse(healthResponse.body)
			console.log(`   Health: ${health.status}`)
			console.log(`   Timestamp: ${health.timestamp}`)
		} else {
			console.log(`   Error: ${healthResponse.body}`)
		}
		console.log("")
	} catch (error) {
		console.log(`   ❌ Failed: ${error.message}\n`)
	}

	// Test status endpoint
	try {
		console.log("📈 GET /status")
		const statusResponse = await makeRequest({
			hostname: host,
			port: port,
			path: "/status",
			method: "GET",
			headers: { "Content-Type": "application/json" },
		})

		console.log(`   Status: ${statusResponse.statusCode}`)
		if (statusResponse.statusCode === 200) {
			const status = JSON.parse(statusResponse.body)
			console.log(`   Running: ${status.running}`)
			console.log(`   Requests: ${status.stats?.totalRequests || 0}`)
			console.log(`   Memory: ${Math.round((status.stats?.memoryUsage?.heapUsed || 0) / 1024 / 1024)}MB`)
		} else {
			console.log(`   Error: ${statusResponse.body}`)
		}
		console.log("")
	} catch (error) {
		console.log(`   ❌ Failed: ${error.message}\n`)
	}
}

/**
 * Test regular execute endpoint
 */
async function testExecuteEndpoint() {
	console.log("⚡ Testing POST /execute...\n")

	try {
		const payload = JSON.stringify({ task })

		const response = await makeRequest(
			{
				hostname: host,
				port: port,
				path: "/execute",
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(payload),
				},
			},
			payload,
		)

		console.log(`   Status: ${response.statusCode}`)
		if (response.statusCode === 200) {
			const result = JSON.parse(response.body)
			console.log(`   Success: ${result.success}`)
			console.log(`   Message: ${result.message}`)
			console.log(`   Task: ${result.task}`)
			console.log(`   Timestamp: ${result.timestamp}`)
		} else {
			console.log(`   Error: ${response.body}`)
		}
		console.log("")
	} catch (error) {
		console.log(`   ❌ Failed: ${error.message}\n`)
	}
}

/**
 * Test SSE streaming endpoint
 */
function testStreamingEndpoint() {
	return new Promise((resolve, reject) => {
		console.log("🌊 Testing POST /execute/stream (SSE)...\n")

		const payload = JSON.stringify({ task })

		const req = http.request(
			{
				hostname: host,
				port: port,
				path: "/execute/stream",
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(payload),
					Accept: "text/event-stream",
					"Cache-Control": "no-cache",
				},
			},
			(res) => {
				console.log(`   Status: ${res.statusCode}`)
				console.log(`   Content-Type: ${res.headers["content-type"]}`)
				console.log("   Events:")

				let buffer = ""

				res.on("data", (chunk) => {
					buffer += chunk.toString()

					// Process complete SSE messages
					const lines = buffer.split("\n")
					buffer = lines.pop() || "" // Keep incomplete line in buffer

					for (const line of lines) {
						if (line.startsWith("data: ")) {
							try {
								const data = JSON.parse(line.slice(6))
								const timestamp = new Date(data.timestamp).toLocaleTimeString()

								switch (data.type) {
									case "start":
										console.log(`     🚀 [${timestamp}] ${data.message}: ${data.task}`)
										break
									case "progress":
										console.log(
											`     ⏳ [${timestamp}] Step ${data.step}/${data.total}: ${data.message}`,
										)
										break
									case "complete":
									case "completion":
										console.log(`     ✅ [${timestamp}] ${data.message}`)
										console.log(`     📋 Result: ${data.result}`)
										// Close the connection when task completes
										console.log("     🔚 Task completed, closing connection...")
										res.destroy()
										return
									case "error":
										console.log(`     ❌ [${timestamp}] Error: ${data.error}`)
										break
									default:
										console.log(`     📨 [${timestamp}] ${JSON.stringify(data)}`)
								}
							} catch (e) {
								console.log(`     📄 Raw: ${line}`)
							}
						}
					}
				})

				res.on("end", () => {
					console.log("     🔚 Stream ended\n")
					resolve()
				})

				res.on("error", (error) => {
					console.log(`     ❌ Stream error: ${error.message}\n`)
					reject(error)
				})
			},
		)

		req.on("error", (error) => {
			console.log(`   ❌ Request failed: ${error.message}\n`)
			reject(error)
		})

		req.write(payload)
		req.end()
	})
}

/**
 * Main test function
 */
async function runTests() {
	try {
		// Test basic endpoints first
		await testBasicEndpoints()

		if (useStream) {
			// Test streaming endpoint
			await testStreamingEndpoint()
		} else {
			// Test regular execute endpoint
			await testExecuteEndpoint()
		}

		console.log("✅ All tests completed successfully!")
	} catch (error) {
		console.error("❌ Test failed:", error.message)
		process.exit(1)
	}
}

// Run the tests
runTests()
