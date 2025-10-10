// 测试原生模块是否能正常加载
const path = require("path")

console.log("Testing native modules...\n")

// Test image processor
try {
	console.log("1. Testing image-processor module...")
	const imageProcessor = require("./image-processor/index.node")
	console.log("   ✓ Image processor loaded successfully")
	console.log("   Available functions:", Object.keys(imageProcessor))

	// Test base64 encoding
	const testBuffer = Buffer.from("Hello, Rust!")
	const encoded = imageProcessor.encodeBase64(testBuffer)
	console.log("   ✓ encodeBase64 works:", encoded)

	const decoded = imageProcessor.decodeBase64(encoded)
	console.log("   ✓ decodeBase64 works:", decoded.toString())

	console.log("   ✓ Image processor tests passed!\n")
} catch (error) {
	console.error("   ✗ Image processor failed:", error.message)
	process.exit(1)
}

// Test file processor
try {
	console.log("2. Testing file-processor module...")
	const fileProcessor = require("./file-processor/index.node")
	console.log("   ✓ File processor loaded successfully")
	console.log("   Available functions:", Object.keys(fileProcessor))

	// Test token estimation
	const tokens = fileProcessor.estimateTokens("Hello world from Rust native module!")
	console.log("   ✓ estimateTokens works:", tokens, "tokens")

	console.log("   ✓ File processor tests passed!\n")
} catch (error) {
	console.error("   ✗ File processor failed:", error.message)
	process.exit(1)
}

console.log("✅ All native modules loaded and tested successfully!")
