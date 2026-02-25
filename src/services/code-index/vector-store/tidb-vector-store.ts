/**
 * TiDB Cloud Vector Store — IVectorStore implementation backed by TiDB Cloud Serverless.
 *
 * Uses TiDB's native VECTOR type and VEC_COSINE_DISTANCE() for similarity search.
 * Communicates with TiDB Cloud via the HTTP serverless gateway (no extra npm packages needed
 * beyond `axios` which is already bundled with Joe Code).
 *
 * Connection URL format:
 *   https://<username>:<password>@<host>/database
 * or via separate fields: host, username, password, database.
 *
 * Required TiDB version: TiDB Cloud Serverless (>= 7.6) or TiDB >= 8.4 for VECTOR support.
 */

import axios, { AxiosInstance, AxiosError } from "axios"
import { createHash } from "crypto"
import * as path from "path"
import { IVectorStore } from "../interfaces/vector-store"
import { VectorStoreSearchResult } from "../interfaces"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../constants"

interface TiDBRow {
	[key: string]: any
}

interface TiDBHttpResponse {
	code?: number
	data?: {
		type?: string
		rows?: TiDBRow[]
		columns?: Array<{ col: string; data_type: any; nullable: boolean }>
	}
	// Error fields
	message?: string
	error?: string
}

const TABLE_NAME = "joe_code_vectors"
const METADATA_TABLE_NAME = "joe_code_index_meta"

/**
 * TiDB Cloud Vector Store
 *
 * This class connects to TiDB Cloud Serverless via the HTTP gateway endpoint,
 * executes SQL with VECTOR type and VEC_COSINE_DISTANCE for ANN search.
 */
export class TiDBVectorStore implements IVectorStore {
	private readonly http: AxiosInstance
	private readonly tablePrefix: string
	private readonly vectorsTable: string
	private readonly metaTable: string

	constructor(
		private readonly workspacePath: string,
		private readonly host: string,
		private readonly database: string,
		username: string,
		password: string,
		private readonly vectorSize: number,
	) {
		// Build Basic auth from username:password
		const token = Buffer.from(`${username}:${password}`).toString("base64")

		this.http = axios.create({
			baseURL: `https://${host}/v1/sql`,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Basic ${token}`,
				"User-Agent": "Joe-Code",
			},
			timeout: 30_000,
		})

		// Unique table suffix per workspace to allow multiple projects
		const hash = createHash("sha256").update(workspacePath).digest("hex").substring(0, 12)
		this.tablePrefix = hash
		this.vectorsTable = `${TABLE_NAME}_${hash}`
		this.metaTable = `${METADATA_TABLE_NAME}_${hash}`
	}

	// ─── Private SQL Helpers ───────────────────────────────────────────────────

	/**
	 * Execute SQL against TiDB Cloud HTTP endpoint.
	 * Returns rows as array of objects (keyed by column name).
	 */
	private async query(sql: string, params: any[] = []): Promise<TiDBRow[]> {
		try {
			const body: any = { database: this.database, sql }
			if (params.length > 0) {
				body.params = params.map(String)
			}

			const response = await this.http.post<TiDBHttpResponse>("", body)
			const data = response.data

			if (data.code !== undefined && data.code !== 200) {
				throw new Error(`TiDB error ${data.code}: ${data.message ?? data.error ?? "unknown"}`)
			}

			const rows = data.data?.rows ?? []
			const columns = data.data?.columns ?? []

			if (columns.length === 0) return []

			// Map array rows to keyed objects
			return rows.map((row: any) => {
				if (Array.isArray(row)) {
					const obj: TiDBRow = {}
					columns.forEach((col, i) => {
						obj[col.col] = row[i]
					})
					return obj
				}
				return row as TiDBRow
			})
		} catch (error) {
			if (error instanceof AxiosError) {
				const msg = error.response?.data?.message ?? error.message
				throw new Error(`[TiDBVectorStore] HTTP error: ${msg}`)
			}
			throw error
		}
	}

	/** Execute SQL that does not return rows (CREATE, INSERT, DELETE, etc.) */
	private async execute(sql: string, params: any[] = []): Promise<void> {
		await this.query(sql, params)
	}

	// ─── IVectorStore ──────────────────────────────────────────────────────────

	/**
	 * Creates the vectors table and metadata table if they don't exist.
	 * Returns true if tables were newly created.
	 */
	async initialize(): Promise<boolean> {
		try {
			// Create vectors table with TiDB VECTOR type
			await this.execute(`
				CREATE TABLE IF NOT EXISTS \`${this.vectorsTable}\` (
					id VARCHAR(64) NOT NULL PRIMARY KEY,
					file_path TEXT NOT NULL,
					code_chunk MEDIUMTEXT NOT NULL,
					start_line INT NOT NULL DEFAULT 0,
					end_line   INT NOT NULL DEFAULT 0,
					embedding  VECTOR(${this.vectorSize}) NOT NULL COMMENT 'hnsw(distance=cosine)',
					path_hash  VARCHAR(64) NOT NULL DEFAULT '',
					INDEX idx_path_hash (path_hash)
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
			`)

			// Create metadata table
			await this.execute(`
				CREATE TABLE IF NOT EXISTS \`${this.metaTable}\` (
					meta_key   VARCHAR(64) NOT NULL PRIMARY KEY,
					meta_value TEXT NOT NULL,
					updated_at BIGINT NOT NULL DEFAULT 0
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
			`)

			// Check if the table already had data
			const rows = await this.query(
				`SELECT meta_value FROM \`${this.metaTable}\` WHERE meta_key = 'indexing_complete'`,
			)
			const alreadyComplete = rows[0]?.meta_value === "true"

			console.log(`[TiDBVectorStore] Initialized table ${this.vectorsTable}`)
			return !alreadyComplete
		} catch (error) {
			console.error("[TiDBVectorStore] Failed to initialize:", error)
			throw new Error(`[TiDBVectorStore] Initialization failed: ${(error as Error).message}`)
		}
	}

	/**
	 * Upserts vector points into TiDB.
	 */
	async upsertPoints(
		points: Array<{ id: string; vector: number[]; payload: Record<string, any> }>,
	): Promise<void> {
		if (points.length === 0) return

		// Batch insert in chunks of 50 to avoid huge SQL statements
		const CHUNK_SIZE = 50
		for (let i = 0; i < points.length; i += CHUNK_SIZE) {
			const chunk = points.slice(i, i + CHUNK_SIZE)
			const values = chunk.map((p) => {
				const filePath = p.payload?.filePath ?? ""
				const codeChunk = p.payload?.codeChunk ?? ""
				const startLine = Number(p.payload?.startLine ?? 0)
				const endLine = Number(p.payload?.endLine ?? 0)
				const vectorStr = `[${p.vector.join(",")}]`
				const pathHash = createHash("md5").update(filePath).digest("hex")

				// Escape single quotes in strings
				const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")

				return `('${p.id}', '${escape(filePath)}', '${escape(codeChunk)}', ${startLine}, ${endLine}, '${vectorStr}', '${pathHash}')`
			})

			const sql = `
				INSERT INTO \`${this.vectorsTable}\`
					(id, file_path, code_chunk, start_line, end_line, embedding, path_hash)
				VALUES ${values.join(",")}
				ON DUPLICATE KEY UPDATE
					file_path = VALUES(file_path),
					code_chunk = VALUES(code_chunk),
					start_line = VALUES(start_line),
					end_line   = VALUES(end_line),
					embedding  = VALUES(embedding),
					path_hash  = VALUES(path_hash)
			`
			await this.execute(sql)
		}
	}

	/**
	 * ANN vector search using VEC_COSINE_DISTANCE.
	 * TiDB uses an HNSW index defined in the column comment.
	 */
	async search(
		queryVector: number[],
		directoryPrefix?: string,
		minScore?: number,
		maxResults?: number,
	): Promise<VectorStoreSearchResult[]> {
		const limit = maxResults ?? DEFAULT_MAX_SEARCH_RESULTS
		const threshold = 1 - (minScore ?? DEFAULT_SEARCH_MIN_SCORE) // cosine distance = 1 - similarity

		const vectorStr = `[${queryVector.join(",")}]`

		let whereClause = `WHERE distance <= ${threshold}`
		if (directoryPrefix) {
			const norm = directoryPrefix.replace(/'/g, "\\'")
			whereClause += ` AND file_path LIKE '${norm}%'`
		}

		const sql = `
			SELECT
				id,
				file_path,
				code_chunk,
				start_line,
				end_line,
				(1 - VEC_COSINE_DISTANCE(embedding, '${vectorStr}')) AS similarity,
				VEC_COSINE_DISTANCE(embedding, '${vectorStr}') AS distance
			FROM \`${this.vectorsTable}\`
			${whereClause}
			ORDER BY distance ASC
			LIMIT ${limit}
		`

		try {
			const rows = await this.query(sql)

			return rows.map((row) => ({
				id: row.id as string,
				score: parseFloat(row.similarity ?? "0"),
				payload: {
					filePath: row.file_path as string,
					codeChunk: row.code_chunk as string,
					startLine: parseInt(row.start_line ?? "0", 10),
					endLine: parseInt(row.end_line ?? "0", 10),
				},
			}))
		} catch (error) {
			console.error("[TiDBVectorStore] Search failed:", error)
			throw error
		}
	}

	/**
	 * Delete all points for a single file.
	 */
	async deletePointsByFilePath(filePath: string): Promise<void> {
		return this.deletePointsByMultipleFilePaths([filePath])
	}

	/**
	 * Delete all points for multiple files.
	 */
	async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (filePaths.length === 0) return

		const hashes = filePaths.map((fp) => {
			const h = createHash("md5").update(fp).digest("hex")
			return `'${h}'`
		})

		await this.execute(
			`DELETE FROM \`${this.vectorsTable}\` WHERE path_hash IN (${hashes.join(",")})`,
		)
	}

	/**
	 * Delete all rows from the vectors table (keeps table structure).
	 */
	async clearCollection(): Promise<void> {
		await this.execute(`TRUNCATE TABLE \`${this.vectorsTable}\``)
		await this.execute(`TRUNCATE TABLE \`${this.metaTable}\``)
	}

	/**
	 * Drop the vectors and metadata tables entirely.
	 */
	async deleteCollection(): Promise<void> {
		await this.execute(`DROP TABLE IF EXISTS \`${this.vectorsTable}\``)
		await this.execute(`DROP TABLE IF EXISTS \`${this.metaTable}\``)
	}

	/**
	 * Returns true if the vectors table exists.
	 */
	async collectionExists(): Promise<boolean> {
		try {
			const rows = await this.query(
				`SELECT COUNT(*) AS cnt
				 FROM information_schema.tables
				 WHERE table_schema = DATABASE()
				   AND table_name = '${this.vectorsTable}'`,
			)
			return parseInt(rows[0]?.cnt ?? "0", 10) > 0
		} catch {
			return false
		}
	}

	/**
	 * Returns true if the table exists AND indexing was marked complete.
	 */
	async hasIndexedData(): Promise<boolean> {
		try {
			if (!(await this.collectionExists())) return false

			const rows = await this.query(
				`SELECT meta_value FROM \`${this.metaTable}\` WHERE meta_key = 'indexing_complete'`,
			)
			if (rows.length > 0) {
				return rows[0].meta_value === "true"
			}

			// Fallback: check row count
			const countRows = await this.query(`SELECT COUNT(*) AS cnt FROM \`${this.vectorsTable}\``)
			return parseInt(countRows[0]?.cnt ?? "0", 10) > 0
		} catch {
			return false
		}
	}

	/**
	 * Record that indexing is complete.
	 */
	async markIndexingComplete(): Promise<void> {
		await this.execute(`
			INSERT INTO \`${this.metaTable}\` (meta_key, meta_value, updated_at)
			VALUES ('indexing_complete', 'true', ${Date.now()})
			ON DUPLICATE KEY UPDATE meta_value = 'true', updated_at = ${Date.now()}
		`)
		console.log("[TiDBVectorStore] Marked indexing as complete")
	}

	/**
	 * Record that indexing is in progress.
	 */
	async markIndexingIncomplete(): Promise<void> {
		await this.execute(`
			INSERT INTO \`${this.metaTable}\` (meta_key, meta_value, updated_at)
			VALUES ('indexing_complete', 'false', ${Date.now()})
			ON DUPLICATE KEY UPDATE meta_value = 'false', updated_at = ${Date.now()}
		`)
		console.log("[TiDBVectorStore] Marked indexing as in-progress")
	}
}
