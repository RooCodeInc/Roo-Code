import chokidar from "chokidar"
import { exec } from "child_process"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const usePolling = process.env.CHOKIDAR_USEPOLLING === "true"
const pollInterval = parseInt(process.env.CHOKIDAR_INTERVAL || "1000", 10)

console.log(`[webview] ========================================`)
console.log(`[webview] Starting watch mode`)
console.log(`[webview] Polling: ${usePolling}, Interval: ${pollInterval}ms`)
console.log(`[webview] Watching: ${path.join(__dirname, "src")}`)
console.log(`[webview] ========================================`)

let buildInProgress = false
let pendingBuild = false

const runBuild = () => {
	if (buildInProgress) {
		pendingBuild = true
		return
	}

	buildInProgress = true
	console.log(`[webview] Building...`)

	exec("pnpm vite build", { cwd: __dirname }, (error, stdout, stderr) => {
		buildInProgress = false

		if (error) {
			console.error(`[webview] Build failed:`, error.message)
			if (stderr) console.error(stderr)
		} else {
			console.log(`[webview] Build complete`)
		}

		if (pendingBuild) {
			pendingBuild = false
			runBuild()
		}
	})
}

const srcDir = path.join(__dirname, "src")
console.log(`[webview] srcDir: ${srcDir}`)

const watcher = chokidar.watch(srcDir, {
	ignored: (filePath) => {
		const relativePath = path.relative(srcDir, filePath)
		return relativePath.includes("node_modules") ||
			relativePath.endsWith(".spec.ts") ||
			relativePath.endsWith(".spec.tsx") ||
			relativePath.endsWith(".test.ts") ||
			relativePath.endsWith(".test.tsx")
	},
	persistent: true,
	usePolling,
	interval: pollInterval,
	ignoreInitial: false, // Count files during initial scan
	depth: 10,
})

let fileCount = 0
let isReady = false

let debounceTimeout = null
watcher.on("change", (filePath) => {
	if (!isReady) return
	if (debounceTimeout) clearTimeout(debounceTimeout)
	debounceTimeout = setTimeout(() => {
		console.log(`[webview] File changed: ${filePath}`)
		runBuild()
	}, 200)
})

watcher.on("add", (filePath) => {
	if (!isReady) {
		fileCount++
		return
	}
	if (debounceTimeout) clearTimeout(debounceTimeout)
	debounceTimeout = setTimeout(() => {
		console.log(`[webview] File added: ${filePath}`)
		runBuild()
	}, 200)
})

watcher.on("unlink", (filePath) => {
	if (!isReady) return
	if (debounceTimeout) clearTimeout(debounceTimeout)
	debounceTimeout = setTimeout(() => {
		console.log(`[webview] File deleted: ${filePath}`)
		runBuild()
	}, 200)
})

watcher.on("ready", () => {
	isReady = true
	console.log(`[webview] ========================================`)
	console.log(`[webview] Watcher ready!`)
	console.log(`[webview] Watching ${fileCount} files`)
	console.log(`[webview] Listening for changes...`)
	console.log(`[webview] ========================================`)
})

watcher.on("error", (error) => {
	console.error(`[webview] Watcher error:`, error)
})
