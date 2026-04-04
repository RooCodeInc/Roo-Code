const fs = require("fs")
const path = require("path")

const targetDirs = ["apps/web-jabberwock/public", "apps/web-jabberwock", "packages/types/npm", "src"]

let replacedCount = 0

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
			results.push(filePath)
		}
	})
	return results
}

let files = []
targetDirs.forEach((dir) => {
	const fullPath = path.join(__dirname, dir)
	if (fs.existsSync(fullPath)) {
		if (fs.statSync(fullPath).isDirectory()) {
			files = files.concat(walk(fullPath))
		} else {
			files.push(fullPath)
		}
	}
})

files.forEach((file) => {
	try {
		let content = fs.readFileSync(file, "utf8")
		let changed = false

		const replacements = [
			{ from: /roocode\.com/g, to: "jabberwock.com" },
			{ from: /roocode/g, to: "jabberwock" },
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
	} catch (e) {
		// Skip non-text files or other errors
	}
})

console.log(`Done! Replaced in ${replacedCount} files.`)
