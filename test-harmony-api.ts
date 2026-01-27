import OpenAI from "openai"

async function testHarmonyAPI() {
	// Check for required environment variables
	const harmonyBaseUrl = process.env.HARMONY_BASE_URL
	const harmonyApiKey = process.env.HARMONY_API_KEY

	if (!harmonyBaseUrl) {
		console.error("❌ Error: HARMONY_BASE_URL environment variable is not set")
		console.error("Please set it before running this test:")
		console.error("  export HARMONY_BASE_URL=https://your-harmony-endpoint/v1")
		process.exit(1)
	}

	if (!harmonyApiKey) {
		console.error("❌ Error: HARMONY_API_KEY environment variable is not set")
		console.error("Please set it before running this test:")
		console.error("  export HARMONY_API_KEY=your-api-key")
		process.exit(1)
	}

	console.log("Testing Harmony API Compatibility...\n")

	const client = new OpenAI({
		baseURL: harmonyBaseUrl,
		apiKey: harmonyApiKey,
	})

	try {
		console.log("1. Testing basic chat completion (non-streaming)...")
		const response = await client.chat.completions.create({
			model: "gpt-oss-20b",
			messages: [
				{
					role: "user",
					content: "Hello! What is 2+2?",
				},
			],
			temperature: 0.7,
			max_tokens: 100,
		})

		console.log("✅ Response received:")
		console.log(JSON.stringify(response, null, 2))
		console.log("\n---\n")

		if (response.choices && response.choices.length > 0) {
			const message = response.choices[0].message
			console.log("Message content:", message.content)
			console.log("Message role:", message.role)
		} else {
			console.log("⚠️ WARNING: No choices in response!")
		}

		console.log("\n2. Testing streaming chat completion...")
		const stream = await client.chat.completions.create({
			model: "gpt-oss-20b",
			messages: [
				{
					role: "user",
					content: "Say hello in 5 words",
				},
			],
			temperature: 0.7,
			max_tokens: 50,
			stream: true,
		})

		console.log("✅ Stream started. Chunks:")
		let chunkCount = 0
		for await (const chunk of stream) {
			chunkCount++
			console.log(`Chunk ${chunkCount}:`, JSON.stringify(chunk, null, 2))

			if (chunk.choices && chunk.choices.length > 0) {
				const delta = chunk.choices[0].delta
				if (delta.content) {
					process.stdout.write(delta.content)
				}
			}
		}
		console.log("\n\n✅ Stream completed successfully")

		console.log("\n3. Testing with different parameters...")
		const response2 = await client.chat.completions.create({
			model: "gpt-oss-20b",
			messages: [
				{
					role: "user",
					content: "Return a JSON object with keys 'name' and 'value'",
				},
			],
			temperature: 0.5,
			max_tokens: 200,
		})

		console.log("✅ Response 2:")
		console.log(JSON.stringify(response2.choices, null, 2))
	} catch (error) {
		console.error("❌ Error occurred:")
		if (error instanceof OpenAI.APIError) {
			console.error("API Error:", error.status, error.message)
			console.error("Error details:", error.error)
		} else if (error instanceof Error) {
			console.error("Error:", error.message)
			console.error("Stack:", error.stack)
		} else {
			console.error("Unknown error:", error)
		}
	}
}

testHarmonyAPI()
