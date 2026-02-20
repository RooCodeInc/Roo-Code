import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

// Walk up from the current file to find the nearest package.json.
// This works whether running from source (tsx src/lib/utils/) or bundle (dist/).
function findVersion(): string {
	let dir = path.dirname(fileURLToPath(import.meta.url))

	while (dir !== path.dirname(dir)) {
		const candidate = path.join(dir, "package.json")

		if (fs.existsSync(candidate)) {
			const packageJson = JSON.parse(fs.readFileSync(candidate, "utf-8"))
			return packageJson.version
		}

		dir = path.dirname(dir)
	}

	return "0.0.0"
}

export const VERSION = findVersion()
