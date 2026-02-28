import { preWriteHook } from "./preHook"
import { postWriteHook } from "./postHook"
import fs from "fs"

// Wrap the write_file tool
export async function writeFileWithHooks(
	filePath: string,
	content: string,
	intentId: string,
	sessionId: string,
	contributorModel: string,
) {
	// PREHOOK: validate intent + scope
	const intent = preWriteHook(filePath, intentId)

	// backup old file for AST diff
	if (fs.existsSync(filePath)) {
		fs.copyFileSync(filePath, filePath + ".bak")
	}

	// ACTUAL WRITE
	fs.writeFileSync(filePath, content, "utf-8")

	// POSTHOOK: trace log
	postWriteHook(filePath, intent, sessionId, contributorModel)
}
