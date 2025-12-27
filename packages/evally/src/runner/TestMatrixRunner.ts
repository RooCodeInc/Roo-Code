import type {
	MatrixRunOptions,
	MatrixTestDescription,
	MatrixTestFn,
	MatrixSuiteDefinition,
	MatrixTestResult,
} from "./types"
import * as path from "path"
import * as fs from "fs/promises"

const COLORS = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	gray: "\x1b[90m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	cyan: "\x1b[36m",
} as const

function color(text: string, code: string): string {
	return `${code}${text}${COLORS.reset}`
}

function formatDuration(ms: number): string {
	if (ms >= 60_000) {
		const minutes = Math.round(ms / 60_000)
		return `${minutes}m`
	}
	if (ms >= 1_000) {
		const seconds = ms / 1_000
		return `${seconds.toFixed(1)}s`
	}
	return `${ms}ms`
}
const testRegistry: MatrixTestDescription[] = []
let currentSuite: string | null = null

export function describe(suiteName: string, fn: () => void) {
	const prevSuite = currentSuite
	currentSuite = suiteName
	fn()
	currentSuite = prevSuite
}

export function it(name: string, fn: MatrixTestFn) {
	if (!currentSuite) throw new Error("Cannot declare test outside a describe(suiteName, ...) block.")
	if (testRegistry.some((test) => test.suite === currentSuite && test.name === name)) {
		throw new Error(
			`Duplicate test name found in suite '${currentSuite}': ${name}. Test names must be unique within a suite.`,
		)
	}
	testRegistry.push({ suite: currentSuite, name, fn })
}

export const suite = describe
export const test = it

type SetupFn = () => Promise<void> | void
const _globalBeforeAll: SetupFn[] = []
const _globalAfterAll: SetupFn[] = []
const _globalBeforeEach: SetupFn[] = []
const _globalAfterEach: SetupFn[] = []

export function beforeAll(fn: SetupFn) {
	_globalBeforeAll.push(fn)
}
export const suiteSetup = beforeAll

export function afterAll(fn: SetupFn) {
	_globalAfterAll.push(fn)
}
export const suiteTeardown = afterAll

export function beforeEach(fn: SetupFn) {
	_globalBeforeEach.push(fn)
}
export const setup = beforeEach

export function teardown(fn: SetupFn) {
	_globalAfterEach.push(fn)
}
export const afterEach = teardown

function clearGlobalHooks() {
	_globalBeforeAll.length = 0
	_globalAfterAll.length = 0
	_globalBeforeEach.length = 0
	_globalAfterEach.length = 0
}
export function defineMatrix(def: MatrixSuiteDefinition): MatrixSuiteDefinition {
	if (typeof def.suiteSetup === "function") {
		suiteSetup(def.suiteSetup)
	}
	if (typeof def.setup === "function") {
		setup(def.setup)
	}
	if (typeof def.suiteTeardown === "function") {
		suiteTeardown(def.suiteTeardown)
	}
	if (typeof def.teardown === "function") {
		teardown(def.teardown)
	}
	return def
}

export async function runMatrix(def: MatrixSuiteDefinition, opts?: MatrixRunOptions): Promise<MatrixTestResult[]> {
	const startTime = Date.now()
	const verbosity: MatrixRunOptions["verbosity"] = opts?.verbosity ?? "silent"

	const originalConsole = {
		log: console.log,
		info: console.info,
		warn: console.warn,
		error: console.error,
		debug: console.debug,
	} as const

	const runnerConsole = {
		log: originalConsole.log,
		error: originalConsole.error,
	} as const

	if (verbosity === "silent") {
		console.log = () => {}
		console.info = () => {}
		console.warn = () => {}
		console.error = () => {}
		console.debug = () => {}
	}
	testRegistry.length = 0
	currentSuite = null

	const results: MatrixTestResult[] = []

	try {
		def.tests()

		for (const hook of _globalBeforeAll) {
			await Promise.resolve(hook())
		}

		for (const variable of def.variables) {
			for (let i = 0; i < def.iterations; ++i) {
				for (const t of testRegistry) {
					for (const hook of _globalBeforeEach) {
						await Promise.resolve(hook())
					}

					try {
						await Promise.resolve(t.fn({ variable, iteration: i }))
						results.push({ suite: t.suite, variable, iteration: i, testName: t.name, passed: true })
					} catch (e) {
						results.push({
							suite: t.suite,
							variable,
							iteration: i,
							testName: t.name,
							passed: false,
							error: e,
						})
					}
					for (const hook of _globalAfterEach) {
						await Promise.resolve(hook())
					}
				}
			}
		}

		for (const hook of _globalAfterAll) {
			await Promise.resolve(hook())
		}
	} finally {
		console.log = originalConsole.log
		console.info = originalConsole.info
		console.warn = originalConsole.warn
		console.error = originalConsole.error
		console.debug = originalConsole.debug
	}

	const shouldPrintSuitesAndTests = verbosity !== "silent"

	if (!opts || opts.report !== false) {
		const grouped: Record<string, MatrixTestResult[]> = {}
		for (const r of results) {
			if (!grouped[r.suite]) grouped[r.suite] = []
			grouped[r.suite].push(r)
		}

		if (shouldPrintSuitesAndTests) {
			for (const suite in grouped) {
				const suiteLabel = color("Suite:", COLORS.bold)
				const suiteName = color(suite, COLORS.dim)
				runnerConsole.log(`\n${suiteLabel} ${suiteName}`)

				const perTestStats: Record<string, { total: number; passed: number; failed: number }> = {}

				for (const r of grouped[suite]) {
					if (!perTestStats[r.testName]) {
						perTestStats[r.testName] = { total: 0, passed: 0, failed: 0 }
					}
					perTestStats[r.testName].total += 1
					if (r.passed) perTestStats[r.testName].passed += 1
					else perTestStats[r.testName].failed += 1

					const mark = r.passed ? color("✓", COLORS.green) : color("✗", COLORS.red)
					const name = r.testName
					const iterationTag = `[iteration ${r.iteration}]`

					const base = `  ${mark} ${name} ${color(iterationTag, COLORS.gray)}`
					const errorSuffix =
						r.passed || !r.error
							? ""
							: " -- " +
								color(r.error instanceof Error ? r.error.message : String(r.error), COLORS.yellow)

					runnerConsole.log(base + errorSuffix)
				}

				const statsEntries = Object.entries(perTestStats)
				if (statsEntries.length > 0) {
					const statsHeader = color("Per-test iteration stats:", COLORS.bold)
					runnerConsole.log(`  ${statsHeader}`)

					const jsonTests: Array<{
						testName: string
						totalIterations: number
						passedIterations: number
						failedIterations: number
						failureRate: number
						classification: "FAILED" | "FLAKY" | "PASSED"
					}> = []

					for (const [testName, stats] of statsEntries.sort(([a], [b]) => a.localeCompare(b))) {
						const { total, passed, failed } = stats
						const failRate = total > 0 ? failed / total : 0
						const failPct = (failRate * 100).toFixed(1)
						let statusLabel: string
						let classification: "FAILED" | "FLAKY" | "PASSED"
						if (failRate >= 0.8) {
							statusLabel = color("FAILED", COLORS.red)
							classification = "FAILED"
						} else if (failed === 0) {
							statusLabel = color("PASSED", COLORS.green)
							classification = "PASSED"
						} else {
							statusLabel = color("FLAKY", COLORS.yellow)
							classification = "FLAKY"
						}

						runnerConsole.log(
							`    - ${testName}: ${passed}/${total} iterations passed, ${failed} failed (${failPct}% failure) [${statusLabel}]`,
						)

						jsonTests.push({
							testName,
							totalIterations: total,
							passedIterations: passed,
							failedIterations: failed,
							failureRate: failRate,
							classification,
						})
					}
				}
			}
		}

		const passedTotal = results.filter((r) => r.passed).length
		const failedTotal = results.length - passedTotal
		const matrixLabel = color("Matrix:", COLORS.bold)
		const matrixSummary =
			failedTotal === 0
				? color(`${passedTotal}/${results.length} passing`, COLORS.green)
				: color(`${passedTotal}/${results.length} passing`, COLORS.red)
		runnerConsole.log(`\n${matrixLabel} ${matrixSummary}\n`)
		const duration = Date.now() - startTime
		const durationText = formatDuration(duration)
		const pendingTotal = 0
		runnerConsole.log(color(`${passedTotal} passing (${durationText})`, COLORS.green))

		runnerConsole.log("  " + color(`${pendingTotal} pending`, COLORS.cyan))

		const failingColor = failedTotal > 0 ? COLORS.red : COLORS.gray
		runnerConsole.log("  " + color(`${failedTotal} failing`, failingColor))

		try {
			const resultsDir = path.join(process.cwd(), ".results")
			const timestamp = new Date(startTime).toISOString().replace(/[:.]/g, "-")
			const logsDir = path.join(resultsDir, `matrix-logs-${timestamp}`)
			const filePath = path.join(resultsDir, `matrix-results-${timestamp}.json`)

			const sanitizeForFilename = (value: string): string =>
				value
					.replace(/[^a-zA-Z0-9-_]+/g, "_")
					.replace(/_+/g, "_")
					.replace(/^_+|_+$/g, "")
					.slice(0, 80) || "unnamed"

			type AggregatedTestJson = {
				testName: string
				pass_count: number
				fail_count: number
				passed: boolean
				errors: Array<{ message: string; log: string | null }>
			}

			const aggregatedSuites: Array<{ suite: string; tests: AggregatedTestJson[] }> = []
			const failedIterationLogs: Array<{ filePath: string; content: string }> = []
			for (const [suiteName, suiteResults] of Object.entries(grouped)) {
				const perTest: Record<string, MatrixTestResult[]> = {}
				for (const r of suiteResults) {
					if (!perTest[r.testName]) perTest[r.testName] = []
					perTest[r.testName].push(r)
				}

				const tests: AggregatedTestJson[] = []

				for (const [testName, iterations] of Object.entries(perTest).sort(([a], [b]) => a.localeCompare(b))) {
					const totalIterations = iterations.length
					const passedIterations = iterations.filter((r) => r.passed).length
					const failedIterations = totalIterations - passedIterations
					const passRate = totalIterations > 0 ? passedIterations / totalIterations : 0

					const aggregatedPassed = passRate >= 0.8

					const errors: Array<{ message: string; log: string | null }> = []

					for (const r of iterations) {
						if (r.passed) continue

						const errorMessage =
							r.error instanceof Error
								? r.error.message
								: r.error != null
									? String(r.error)
									: "Unknown error"

						const logFileName =
							[
								"matrix",
								sanitizeForFilename(suiteName),
								sanitizeForFilename(testName),
								`iter-${r.iteration}`,
							].join("__") + ".log"

						const logAbsolutePath = path.join(logsDir, logFileName)
						const logRelativePath = path.relative(process.cwd(), logAbsolutePath)

						const logLines = [
							`suite: ${suiteName}`,
							`test: ${testName}`,
							`iteration: ${r.iteration}`,
							`runStartTime: ${new Date(startTime).toISOString()}`,
							"",
							"variable:",
							JSON.stringify(r.variable, null, 2),
							"",
							"error:",
							r.error instanceof Error ? (r.error.stack ?? r.error.message) : errorMessage,
							"",
						].join("\n")

						failedIterationLogs.push({ filePath: logAbsolutePath, content: logLines })

						errors.push({
							message: errorMessage,
							log: logRelativePath,
						})
					}

					tests.push({
						testName,
						pass_count: passedIterations,
						fail_count: failedIterations,
						passed: aggregatedPassed,
						errors,
					})
				}

				aggregatedSuites.push({ suite: suiteName, tests })
			}

			const jsonPayload = {
				summary: {
					totalIterations: results.length,
					passedIterations: passedTotal,
					failedIterations: failedTotal,
					durationMs: duration,
					startTime: new Date(startTime).toISOString(),
				},
				results: aggregatedSuites,
			}
			await fs.mkdir(resultsDir, { recursive: true })
			if (failedIterationLogs.length > 0) {
				await fs.mkdir(logsDir, { recursive: true })
				for (const entry of failedIterationLogs) {
					await fs.writeFile(entry.filePath, entry.content, "utf8")
				}
			}
			await fs.writeFile(filePath, JSON.stringify(jsonPayload, null, 2), "utf8")
		} catch (err) {
			runnerConsole.error("Failed to write matrix JSON to results folder:", err)
		}
	}
	clearGlobalHooks()
	return results
}
