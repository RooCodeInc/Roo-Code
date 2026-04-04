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
				filePath.endsWith(".js") ||
				filePath.endsWith(".svg") ||
				filePath.endsWith(".png")
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

let count = 0
files.forEach((file) => {
	const basename = path.basename(file)
	if (basename.includes("roo") || basename.includes("Roo")) {
		let newBasename = basename
		newBasename = newBasename.replace(/roo/g, "jabberwock")
		newBasename = newBasename.replace(/Roo/g, "Jabberwock")

		const newPath = path.join(path.dirname(file), newBasename)
		fs.renameSync(file, newPath)
		count++
		console.log(`Renamed: ${basename} -> ${newBasename}`)
	}
})
console.log(`Done! Renamed ${count} files.`)
