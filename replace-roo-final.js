const fs = require("fs")
const path = require("path")

function walk(dir) {
	let results = []
	const list = fs.readdirSync(dir)
	list.forEach((file) => {
		const filePath = path.join(dir, file)
		const stat = fs.statSync(filePath)
		if (stat && stat.isDirectory()) {
			if (!["node_modules", "dist", "out", ".git", ".turbo", "npm", "bin"].includes(file)) {
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
		{ from: /\.roomodes/g, to: ".jabberwockmodes" },
		{ from: /\.roorules/g, to: ".jabberwockrules" },
		{ from: /\.rooignore/g, to: ".jabberwockignore" },
		{ from: /\.roo/g, to: ".jabberwock" },
		{ from: /rooCloud/g, to: "jabberwockCloud" },
		{ from: /rooTips/g, to: "jabberwockTips" },
		{ from: /rooSaid/g, to: "jabberwockSaid" },
		{ from: /backToRoo/g, to: "backToJabberwock" },
		{ from: /rooCloudProvider/g, to: "jabberwockCloudProvider" },
		{ from: /rooCloudDescription/g, to: "jabberwockCloudDescription" },
		{ from: /rooCloudCTA/g, to: "jabberwockCloudCTA" },
		{ from: /\broo\b/g, to: "jabberwock" },
		{ from: /\bRoo\b/g, to: "Jabberwock" },
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
