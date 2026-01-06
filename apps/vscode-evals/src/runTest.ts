import * as path from "path"
import * as os from "os"
import * as fs from "fs/promises"

import { runTests } from "@vscode/test-electron"

async function main() {
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, "../../../src")
		const extensionTestsPath = path.resolve(__dirname, "./suite/index")
		const testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), "roo-evals-workspace-"))
		const testGrep = process.argv.find((arg, i) => process.argv[i - 1] === "--grep") || process.env.TEST_GREP
		const testFile = process.argv.find((arg, i) => process.argv[i - 1] === "--file") || process.env.TEST_FILE
		const extensionTestsEnv = {
			...process.env,
			...(testGrep && { TEST_GREP: testGrep }),
			...(testFile && { TEST_FILE: testFile }),
		}
		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [testWorkspace],
			extensionTestsEnv,
			version: process.env.VSCODE_VERSION || "1.101.2",
		})
		await fs.rm(testWorkspace, { recursive: true, force: true })
	} catch (error) {
		console.error("Failed to run vscode evals", error)
		process.exit(1)
	}
}

main()
