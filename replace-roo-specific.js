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

let replacedCount = 0
files.forEach((file) => {
	let content = fs.readFileSync(file, "utf8")
	let changed = false

	const replacements = [
		{ from: /rooIgnoreController/g, to: "jabberwockIgnoreController" },
		{ from: /rooProtectedController/g, to: "jabberwockProtectedController" },
		{ from: /RooTerminalProcess/g, to: "JabberwockTerminalProcess" },
		{ from: /getFilesReadByRooSafely/g, to: "getFilesReadByJabberwockSafely" },
		{ from: /getFilesReadByRoo/g, to: "getFilesReadByJabberwock" },
		{ from: /filesReadByRoo/g, to: "filesReadByJabberwock" },
		{ from: /rooIgnoreInstructions/g, to: "jabberwockIgnoreInstructions" },
		{ from: /showRooIgnoredFiles/g, to: "showJabberwockIgnoredFiles" },
		{ from: /loadRooLastModelSelection/g, to: "loadJabberwockLastModelSelection" },
		{ from: /saveRooLastModelSelection/g, to: "saveJabberwockLastModelSelection" },
		{ from: /makeRooRequests/g, to: "makeJabberwockRequests" },
		{ from: /rooIgnoreContent/g, to: "jabberwockIgnoreContent" },
		{ from: /rooTaskId/g, to: "jabberwockTaskId" },
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
