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
		{ from: /useRooCreditBalance/g, to: "useJabberwockCreditBalance" },
		{ from: /useRooPortal/g, to: "useJabberwockPortal" },
		{ from: /RooHero/g, to: "JabberwockHero" },
		{ from: /RooTips/g, to: "JabberwockTips" },
		{ from: /RooIgnoreController/g, to: "JabberwockIgnoreController" },
		{ from: /RooProtectedController/g, to: "JabberwockProtectedController" },
		{ from: /RooBalanceDisplay/g, to: "JabberwockBalanceDisplay" },
		{ from: /rooBalance/g, to: "jabberwockBalance" },
		{ from: /roo-auth-gate/g, to: "jabberwock-auth-gate" },
		{ from: /roo\.spec\.ts/g, to: "jabberwock.spec.ts" },
		{ from: /roo\.ts/g, to: "jabberwock.ts" },
		{ from: /roo-logo/g, to: "jabberwock-logo" },
		{ from: /roo\.png/g, to: "jabberwock.png" },
		{ from: /responses-rooignore/g, to: "responses-jabberwockignore" },
		{ from: /roo-last-model-selection/g, to: "jabberwock-last-model-selection" },
		{ from: /Roo-Code/g, to: "Jabberwock-Code" },
		{ from: /RooCode/g, to: "JabberwockCode" },
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
