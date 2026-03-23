/**
 * Minimal type declarations for sql.js (sql-wasm).
 * Only the APIs actually used by the Intelligent Memory System are declared.
 */
declare module "sql.js" {
	type SqlValue = string | number | Uint8Array | null

	interface QueryExecResult {
		columns: string[]
		values: SqlValue[][]
	}

	interface Statement {
		bind(params?: SqlValue[]): boolean
		step(): boolean
		run(params?: SqlValue[]): void
		free(): void
	}

	interface Database {
		run(sql: string, params?: SqlValue[]): Database
		exec(sql: string, params?: SqlValue[]): QueryExecResult[]
		prepare(sql: string): Statement
		export(): Uint8Array
		close(): void
	}

	interface SqlJsStatic {
		Database: new (data?: ArrayLike<number> | Buffer | null) => Database
	}

	interface InitSqlJsOptions {
		locateFile?: (file: string) => string
	}

	export default function initSqlJs(options?: InitSqlJsOptions): Promise<SqlJsStatic>

	export type { Database, Statement, QueryExecResult, SqlValue, SqlJsStatic }
}
