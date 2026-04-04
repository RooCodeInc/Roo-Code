const fs = require("fs")
const path = require("path")

function walk(dir) {
	let results = []
	const list = fs.readdirSync(dir)
	list.forEach((file) => {
		const filePath = path.join(dir, file)
		const stat = fs.statSync(filePath)
		if (stat && stat.isDirectory()) {
			results = results.concat(walk(filePath))
		} else {
			if (filePath.endsWith(".ts")) {
				results.push(filePath)
			}
		}
	})
	return results
}

const files = walk(path.join(__dirname, "packages/types/src"))

files.forEach((file) => {
	let content = fs.readFileSync(file, "utf8")
	if (content.includes('.js"')) {
		content = content.replace(/\.js"/g, '.ts"')
		fs.writeFileSync(file, content, "utf8")
		console.log("Updated:", file)
	}
})
