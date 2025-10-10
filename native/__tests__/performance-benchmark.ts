/**
 * Performance Benchmark Tests
 * 比较 Rust 原生模块和 JavaScript 实现的性能
 *
 * 运行命令: cd src && npx tsx ../native/__tests__/performance-benchmark.ts
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as NativeImageProcessor from "../bindings/image-processor"
import * as NativeFileProcessor from "../bindings/file-processor"

// 性能测试辅助函数
async function benchmark(name: string, fn: () => Promise<void>, iterations: number = 100): Promise<number> {
	// 预热
	await fn()

	const start = performance.now()
	for (let i = 0; i < iterations; i++) {
		await fn()
	}
	const end = performance.now()

	const totalTime = end - start
	const avgTime = totalTime / iterations

	console.log(`${name}: 平均 ${avgTime.toFixed(2)}ms (${iterations} 次迭代, 总计 ${totalTime.toFixed(2)}ms)`)

	return avgTime
}

// 创建测试数据
async function createTestData() {
	const testDir = path.join(__dirname, "../__test-data__")
	await fs.mkdir(testDir, { recursive: true })

	// 创建测试文件 (5MB)
	const largeText = "Hello World! ".repeat(100000) + "\n".repeat(50000)
	const testFile = path.join(testDir, "test-large-file.txt")
	await fs.writeFile(testFile, largeText)

	// 创建测试图片数据 (5MB Base64)
	const imageData = Buffer.alloc(5 * 1024 * 1024, 0xff)
	const testImageFile = path.join(testDir, "test-image.bin")
	await fs.writeFile(testImageFile, imageData)

	return { testFile, testImageFile, imageData }
}

async function runBenchmarks() {
	console.log("=".repeat(80))
	console.log("Rust Native Module 性能基准测试")
	console.log("=".repeat(80))
	console.log()

	// 检查原生模块是否可用
	const imageNativeAvailable = NativeImageProcessor.isNativeAvailable()
	const fileNativeAvailable = NativeFileProcessor.isNativeAvailable()

	console.log(`图片处理原生模块: ${imageNativeAvailable ? "✓ 可用" : "✗ 不可用"}`)
	console.log(`文件处理原生模块: ${fileNativeAvailable ? "✓ 可用" : "✗ 不可用"}`)
	console.log()

	if (!imageNativeAvailable || !fileNativeAvailable) {
		console.error("错误: 原生模块未加载。请先编译 Rust 模块。")
		process.exit(1)
	}

	// 创建测试数据
	console.log("正在创建测试数据...")
	const { testFile, imageData } = await createTestData()
	console.log("测试数据创建完成\n")

	// ========== 测试 1: Base64 编码性能 ==========
	console.log("测试 1: Base64 编码 (5MB 数据)")
	console.log("-".repeat(80))

	const rustBase64Time = await benchmark(
		"Rust Native",
		async () => {
			NativeImageProcessor.encodeBase64(imageData)
		},
		50,
	)

	const jsBase64Time = await benchmark(
		"JavaScript  ",
		async () => {
			imageData.toString("base64")
		},
		50,
	)

	const base64Speedup = jsBase64Time / rustBase64Time
	console.log(`性能提升: ${base64Speedup.toFixed(2)}x 更快 ${base64Speedup >= 6 ? "✓" : "✗ (目标: 6.7x)"}`)
	console.log()

	// ========== 测试 2: Base64 解码性能 ==========
	console.log("测试 2: Base64 解码 (5MB 数据)")
	console.log("-".repeat(80))

	const base64Data = imageData.toString("base64")

	const rustDecodeTime = await benchmark(
		"Rust Native",
		async () => {
			NativeImageProcessor.decodeBase64(base64Data)
		},
		50,
	)

	const jsDecodeTime = await benchmark(
		"JavaScript  ",
		async () => {
			Buffer.from(base64Data, "base64")
		},
		50,
	)

	const decodeSpeedup = jsDecodeTime / rustDecodeTime
	console.log(`性能提升: ${decodeSpeedup.toFixed(2)}x 更快 ${decodeSpeedup >= 6 ? "✓" : "✗ (目标: 6.7x)"}`)
	console.log()

	// ========== 测试 3: 文件行数统计性能 ==========
	console.log("测试 3: 文件行数统计 (大文件)")
	console.log("-".repeat(80))

	const rustCountTime = await benchmark(
		"Rust Native",
		async () => {
			await NativeFileProcessor.countLines(testFile)
		},
		20,
	)

	// JavaScript 实现 (readline)
	const jsCountLinesImpl = async (filePath: string): Promise<number> => {
		const content = await fs.readFile(filePath, "utf-8")
		return content.split("\n").length
	}

	const jsCountTime = await benchmark(
		"JavaScript  ",
		async () => {
			await jsCountLinesImpl(testFile)
		},
		20,
	)

	const countSpeedup = jsCountTime / rustCountTime
	console.log(`性能提升: ${countSpeedup.toFixed(2)}x 更快 ${countSpeedup >= 8 ? "✓" : "✗ (目标: 10x)"}`)
	console.log()

	// ========== 测试 4: 文件读取性能 ==========
	console.log("测试 4: 文件读取性能 (大文件)")
	console.log("-".repeat(80))

	const rustReadTime = await benchmark(
		"Rust Native",
		async () => {
			await NativeFileProcessor.readFileContent(testFile)
		},
		20,
	)

	const jsReadTime = await benchmark(
		"JavaScript  ",
		async () => {
			await fs.readFile(testFile, "utf-8")
		},
		20,
	)

	const readSpeedup = jsReadTime / rustReadTime
	console.log(`性能提升: ${readSpeedup.toFixed(2)}x 更快 ${readSpeedup >= 7 ? "✓" : "✗ (目标: 8x)"}`)
	console.log()

	// ========== 总结 ==========
	console.log("=".repeat(80))
	console.log("测试总结")
	console.log("=".repeat(80))
	console.log()
	console.log(
		`Base64 编码提升:   ${base64Speedup.toFixed(2)}x (目标: 6.7x) ${base64Speedup >= 6 ? "✓ 通过" : "✗ 未达标"}`,
	)
	console.log(
		`Base64 解码提升:   ${decodeSpeedup.toFixed(2)}x (目标: 6.7x) ${decodeSpeedup >= 6 ? "✓ 通过" : "✗ 未达标"}`,
	)
	console.log(
		`行数统计提升:     ${countSpeedup.toFixed(2)}x (目标: 10x)  ${countSpeedup >= 8 ? "✓ 通过" : "✗ 未达标"}`,
	)
	console.log(`文件读取提升:     ${readSpeedup.toFixed(2)}x (目标: 8x)   ${readSpeedup >= 7 ? "✓ 通过" : "✗ 未达标"}`)
	console.log()

	const allPassed = base64Speedup >= 6 && decodeSpeedup >= 6 && countSpeedup >= 8 && readSpeedup >= 7

	if (allPassed) {
		console.log("✅ 所有性能测试通过！")
	} else {
		console.log("⚠️  部分性能测试未达标")
	}
	console.log()

	// 清理测试数据
	await fs.rm(path.join(__dirname, "../__test-data__"), { recursive: true, force: true })
}

// 运行基准测试
runBenchmarks().catch((error) => {
	console.error("基准测试失败:", error)
	process.exit(1)
})
