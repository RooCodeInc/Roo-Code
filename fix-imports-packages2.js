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
			if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
				results.push(filePath)
			}
		}
	})
	return results
}

const targetDirs = ["packages/evals/src", "packages/ipc/src", "packages/build/src"]
let files = []
targetDirs.forEach((dir) => {
	const fullPath = path.join(__dirname, dir)
	if (fs.existsSync(fullPath)) {
		files = files.concat(walk(fullPath))
	}
})

let count = 0
files.forEach((file) => {
	let content = fs.readFileSync(file, "utf8")
	if (content.includes('.js"')) {
		content = content.replace(/\.js"/g, '.ts"')
		fs.writeFileSync(file, content, "utf8")
		count++
		console.log("Updated:", file)
	}
})
console.log(`Done! Replaced in ${count} files.`)
