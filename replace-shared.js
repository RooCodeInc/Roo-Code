const fs = require("fs")
const path = require("path")

function walk(dir) {
	let results = []
	const list = fs.readdirSync(dir)
	list.forEach((file) => {
		const filePath = path.join(dir, file)
		const stat = fs.statSync(filePath)
		if (stat && stat.isDirectory()) {
			if (!["node_modules", "dist", "out", ".git"].includes(file)) {
				results = results.concat(walk(filePath))
			}
		} else {
			if (
				filePath.endsWith(".ts") ||
				filePath.endsWith(".tsx") ||
				filePath.endsWith(".json") ||
				filePath.endsWith(".js") ||
				filePath.endsWith(".mjs")
			) {
				results.push(filePath)
			}
		}
	})
	return results
}

const files = walk(path.join(__dirname, "webview-ui/src"))

const knownPackages = ["types", "core", "ipc", "build", "cloud", "telemetry", "vscode-shim"]

let count = 0
files.forEach((file) => {
	let content = fs.readFileSync(file, "utf8")
	let changed = false

	// Replace @jabberwock/xxx with @shared/xxx unless xxx is in knownPackages
	content = content.replace(/@jabberwock\/([a-zA-Z0-9-]+)/g, (match, p1) => {
		if (knownPackages.includes(p1)) {
			return match
		}
		changed = true
		return `@shared/${p1}`
	})

	if (changed) {
		fs.writeFileSync(file, content, "utf8")
		count++
		console.log("Updated:", file)
	}
})
console.log(`Done! Replaced in ${count} files.`)
