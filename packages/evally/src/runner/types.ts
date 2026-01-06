export interface MatrixVariable {
	[key: string]: any
}

export interface MatrixTestContext {
	variable: MatrixVariable
	iteration: number
}

export type MatrixTestFn = (ctx: MatrixTestContext) => Promise<void> | void

export interface MatrixTestDescription {
	suite: string
	name: string
	fn: MatrixTestFn
}

export interface MatrixSuiteDefinition {
	variables: MatrixVariable[]
	iterations: number
	tests: () => void
	suiteSetup?: () => Promise<void> | void
	suiteTeardown?: () => Promise<void> | void
	setup?: () => Promise<void> | void
	teardown?: () => Promise<void> | void
}

export interface MatrixTestResult {
	suite: string
	variable: MatrixVariable
	iteration: number
	testName: string
	passed: boolean
	error?: any
}

export type MatrixVerbosity = "silent" | "summary" | "verbose"

export interface MatrixRunOptions {
	report?: boolean
	verbosity?: MatrixVerbosity
}
