const fs = require("fs")
const path = require("path")

function walk(dir) {
	let results = []
	const list = fs.readdirSync(dir)
	list.forEach((file) => {
		const filePath = path.join(dir, file)
		const stat = fs.statSync(filePath)
		if (stat && stat.isDirectory()) {
			if (!["node_modules", "dist", "out", ".git", ".turbo", "npm"].includes(file)) {
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

const targetDirs = ["src", "packages", "apps", "webview-ui"]
let files = []
targetDirs.forEach((dir) => {
	const fullPath = path.join(__dirname, dir)
	if (fs.existsSync(fullPath)) {
		files = files.concat(walk(fullPath))
	}
})

let replacedCount = 0
files.forEach((file) => {
	let content = fs.readFileSync(file, "utf8")
	let changed = false

	if (content.includes("rooCode")) {
		content = content.replace(/rooCode/g, "jabberwock")
		changed = true
	}
	if (content.includes("RooCode")) {
		content = content.replace(/RooCode/g, "Jabberwock")
		changed = true
	}

	if (changed) {
		fs.writeFileSync(file, content, "utf8")
		replacedCount++
		console.log("Updated:", file)
	}
})

console.log(`Done! Replaced in ${replacedCount} files.`)
