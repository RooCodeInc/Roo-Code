import * as esbuild from "esbuild"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import process from "node:process"
import * as console from "node:console"
import { setTimeout, clearTimeout } from "node:timers"
import chokidar from "chokidar"

import { copyPaths, copyWasms, copyLocales, setupLocaleWatcher } from "@roo-code/build"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
	const name = "extension"
	const production = process.argv.includes("--production")
	const watch = process.argv.includes("--watch")
	const minify = production
	const sourcemap = true // Always generate source maps for error handling.

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const buildOptions = {
		bundle: true,
		minify,
		sourcemap,
		logLevel: "silent",
		format: "cjs",
		sourcesContent: false,
		platform: "node",
	}

	const srcDir = __dirname
	const buildDir = __dirname
	const distDir = path.join(buildDir, "dist")

	if (fs.existsSync(distDir)) {
		console.log(`[${name}] Cleaning dist directory: ${distDir}`)
		fs.rmSync(distDir, { recursive: true, force: true })
	}

	/**
	 * @type {import('esbuild').Plugin[]}
	 */
	const plugins = [
		{
			name: "copyFiles",
			setup(build) {
				build.onEnd(() => {
					copyPaths(
						[
							["../README.md", "README.md"],
							["../CHANGELOG.md", "CHANGELOG.md"],
							["../LICENSE", "LICENSE"],
							["../.env", ".env", { optional: true }],
							["node_modules/vscode-material-icons/generated", "assets/vscode-material-icons"],
							["../webview-ui/audio", "webview-ui/audio"],
						],
						srcDir,
						buildDir,
					)
				})
			},
		},
		{
			name: "copyWasms",
			setup(build) {
				build.onEnd(() => copyWasms(srcDir, distDir))
			},
		},
		{
			name: "copyLocales",
			setup(build) {
				build.onEnd(() => copyLocales(srcDir, distDir))
			},
		},
		{
			name: "esbuild-problem-matcher",
			setup(build) {
				build.onStart(() => console.log("[esbuild-problem-matcher#onStart]"))
				build.onEnd((result) => {
					result.errors.forEach(({ text, location }) => {
						console.error(`✘ [ERROR] ${text}`)
						if (location && location.file) {
							console.error(`    ${location.file}:${location.line}:${location.column}:`)
						}
					})

					console.log("[esbuild-problem-matcher#onEnd]")
				})
			},
		},
	]

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const extensionConfig = {
		...buildOptions,
		plugins,
		entryPoints: ["extension.ts"],
		outfile: "dist/extension.js",
		// global-agent must be external because it dynamically patches Node.js http/https modules
		// which breaks when bundled. It needs access to the actual Node.js module instances.
		// undici must be bundled because our VSIX is packaged with `--no-dependencies`.
		external: ["vscode", "esbuild", "global-agent"],
	}

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const workerConfig = {
		...buildOptions,
		entryPoints: ["workers/countTokens.ts"],
		outdir: "dist/workers",
	}

	const [extensionCtx, workerCtx] = await Promise.all([
		esbuild.context(extensionConfig),
		esbuild.context(workerConfig),
	])

	if (watch) {
		// Use chokidar for file watching with polling support
		// This is more reliable than esbuild's native watcher in environments like code-server
		const usePolling = process.env.CHOKIDAR_USEPOLLING === "true"
		const pollInterval = parseInt(process.env.CHOKIDAR_INTERVAL || "1000", 10)

		console.log(`[${name}] ========================================`)
		console.log(`[${name}] Starting watch mode`)
		console.log(`[${name}] CHOKIDAR_USEPOLLING: ${process.env.CHOKIDAR_USEPOLLING}`)
		console.log(`[${name}] Polling enabled: ${usePolling}`)
		console.log(`[${name}] Poll interval: ${pollInterval}ms`)
		console.log(`[${name}] Watching directory: ${srcDir}`)
		console.log(`[${name}] CWD: ${process.cwd()}`)
		console.log(`[${name}] ========================================`)

		// Initial build
		await Promise.all([extensionCtx.rebuild(), workerCtx.rebuild()])
		copyLocales(srcDir, distDir)
		setupLocaleWatcher(srcDir, distDir)

		// Set up chokidar watcher - watch the srcDir directly
		console.log(`[${name}] Setting up chokidar watcher...`)
		console.log(`[${name}] srcDir:`, srcDir)
		
		// List files to verify they exist
		const extensionTs = path.join(srcDir, "extension.ts")
		console.log(`[${name}] extension.ts exists:`, fs.existsSync(extensionTs))

		const watcher = chokidar.watch(srcDir, {
			ignored: (filePath) => {
				// Ignore node_modules, dist, and test files
				const relativePath = path.relative(srcDir, filePath)
				return relativePath.includes("node_modules") ||
					   relativePath.includes("dist") ||
					   relativePath.endsWith(".spec.ts") ||
					   relativePath.endsWith(".test.ts")
			},
			persistent: true,
			usePolling,
			interval: pollInterval,
			ignoreInitial: false, // Count files during initial scan
			depth: 10,
		})

		console.log(`[${name}] Watcher created, waiting for ready event...`)

		let rebuildTimeout = null
		let fileCount = 0
		let isReady = false
		
		const triggerRebuild = (eventType, filePath) => {
			if (!isReady) return
			
			// Ignore directories that are written to during build
			const ignoredPaths = [
				"/dist/", "\\dist\\", "/dist", "\\dist",
				"/node_modules/", "\\node_modules\\",
				"/assets/", "\\assets\\",
				"/webview-ui/", "\\webview-ui\\",
			]
			for (const ignored of ignoredPaths) {
				if (filePath.includes(ignored)) {
					return
				}
			}
			
			// Only rebuild for .ts, .tsx source files (not .json since those can be copied)
			const shouldRebuild = (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) &&
				!filePath.endsWith(".d.ts") && !filePath.endsWith(".spec.ts") && !filePath.endsWith(".test.ts")
			if (!shouldRebuild) {
				return
			}
			
			// Debounce rebuilds
			if (rebuildTimeout) {
				clearTimeout(rebuildTimeout)
			}
			rebuildTimeout = setTimeout(async () => {
				console.log(`[${name}] File ${eventType}: ${path.relative(srcDir, filePath)}`)
				console.log(`[esbuild-problem-matcher#onStart]`)
				try {
					await Promise.all([extensionCtx.rebuild(), workerCtx.rebuild()])
					console.log(`[esbuild-problem-matcher#onEnd]`)
				} catch (err) {
					console.error(`[${name}] Rebuild failed:`, err.message)
					console.log(`[esbuild-problem-matcher#onEnd]`)
				}
			}, 200)
		}

		watcher.on("change", (p) => triggerRebuild("changed", p))
		watcher.on("add", (p) => {
			if (!isReady && (p.endsWith(".ts") || p.endsWith(".tsx") || p.endsWith(".json"))) {
				fileCount++
			}
			triggerRebuild("added", p)
		})
		watcher.on("unlink", (p) => triggerRebuild("deleted", p))
		watcher.on("error", (err) => console.error(`[${name}] Watcher error:`, err))
		watcher.on("ready", () => {
			isReady = true
			console.log(`[${name}] ========================================`)
			console.log(`[${name}] Watcher ready!`)
			console.log(`[${name}] Watching ${fileCount} files`)
			console.log(`[${name}] Listening for changes...`)
			console.log(`[${name}] ========================================`)
		})

		// Also add a raw event listener to see ALL events
		watcher.on("raw", (event, rawPath, details) => {
			if (process.env.DEBUG_WATCHER === "true") {
				console.log(`[${name}] Raw event:`, event, rawPath)
			}
		})

		// Keep the process running
		await new Promise(() => {})
	} else {
		await Promise.all([extensionCtx.rebuild(), workerCtx.rebuild()])
		await Promise.all([extensionCtx.dispose(), workerCtx.dispose()])
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
