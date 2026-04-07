import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

import { execa } from "execa"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cliRoot = path.resolve(__dirname, "../..")
const casesDir = path.resolve(__dirname, "cases")

interface RunnerOptions {
	listOnly: boolean
	match?: string
}

function parseArgs(argv: string[]): RunnerOptions {
	let listOnly = false
	let match: string | undefined

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (arg === "--list") {
			listOnly = true
			continue
		}
		if (arg === "--match") {
			match = argv[i + 1]
			i += 1
			continue
		}
	}

	return { listOnly, match }
}

async function discoverCaseFiles(match?: string): Promise<string[]> {
	const entries = await fs.readdir(casesDir, { withFileTypes: true })
	const files = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
		.map((entry) => path.resolve(casesDir, entry.name))
		.sort((a, b) => a.localeCompare(b))

	if (!match) {
		return files
	}

	const normalized = match.toLowerCase()
	return files.filter((file) => path.basename(file).toLowerCase().includes(normalized))
}

async function runCase(caseFile: string): Promise<void> {
	const caseName = path.basename(caseFile, ".ts")
	console.log(`\n[RUN] ${caseName}`)

	await execa("tsx", [caseFile], {
		cwd: cliRoot,
		stdio: "inherit",
		reject: true,
		env: {
			...process.env,
			JABBERWOCK_CLI_JABBERWOCKT: cliRoot,
		},
	})

	console.log(`[PASS] ${caseName}`)
}

async function main() {
	const options = parseArgs(process.argv.slice(2))
	const caseFiles = await discoverCaseFiles(options.match)

	if (caseFiles.length === 0) {
		throw new Error(
			options.match ? `no integration cases matched --match "${options.match}"` : "no integration cases found",
		)
	}

	if (options.listOnly) {
		console.log("Available integration cases:")
		for (const file of caseFiles) {
			console.log(`- ${path.basename(file, ".ts")}`)
		}
		return
	}

	const failures: Array<{ caseName: string; error: string }> = []

	for (const caseFile of caseFiles) {
		const caseName = path.basename(caseFile, ".ts")
		try {
			await runCase(caseFile)
		} catch (error) {
			const errorText = error instanceof Error ? error.message : String(error)
			failures.push({ caseName, error: errorText })
			console.error(`[FAIL] ${caseName}: ${errorText}`)
		}
	}

	const total = caseFiles.length
	const passed = total - failures.length
	console.log(`\nSummary: ${passed}/${total} passed`)

	if (failures.length > 0) {
		process.exitCode = 1
	}
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
