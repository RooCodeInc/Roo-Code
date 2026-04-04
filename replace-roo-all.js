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
				filePath.endsWith(".md") ||
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

files.push(path.join(__dirname, "package.json"))

let replacedCount = 0
files.forEach((file) => {
	let content = fs.readFileSync(file, "utf8")
	let changed = false

	const replacements = [
		{ from: /roo-cline/g, to: "jabberwock" },
		{ from: /Roo Cline/g, to: "Jabberwock" },
		{ from: /Roo Code/g, to: "Jabberwock" },
		{ from: /ROO CODE/g, to: "JABBERWOCK" },
		{ from: /Roo-Code/g, to: "Jabberwock" },
		{ from: /RooCode/g, to: "Jabberwock" },
		{ from: /rooCode/g, to: "jabberwock" },
		{ from: /roocode/g, to: "jabberwock" },
		{ from: /roo_code/g, to: "jabberwock" },
		{ from: /\bRoo\b/g, to: "Jabberwock" },
		{ from: /\broo\b/g, to: "jabberwock" },
		{ from: /ROO/g, to: "JABBERWOCK" },
	]

	replacements.forEach(({ from, to }) => {
		if (from.test(content)) {
			content = content.replace(from, to)
			changed = true
		}
	})

	if (changed) {
		fs.writeFileSync(file, content, "utf8")
		replacedCount++
		console.log("Updated:", file)
	}
})

console.log(`Done! Replaced in ${replacedCount} files.`)
