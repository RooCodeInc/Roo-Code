import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "fs"
import path from "path"
import { ConcurrencyGuard } from "../src/core/intent/ConcurrencyGuard"

describe("Phase 4: Optimistic Locking - Concurrency Control", () => {
	let guard: ConcurrencyGuard
	const testDir = ".orchestration"
	const testFilePath = "test-concurrency-file.ts"

	beforeEach(() => {
		guard = new ConcurrencyGuard()
		guard.clearAllSnapshots()
	})

	afterEach(() => {
		// Cleanup
		try {
			if (fs.existsSync(testFilePath)) {
				fs.unlinkSync(testFilePath)
			}
			if (fs.existsSync(testDir)) {
				const files = fs.readdirSync(testDir)
				files.forEach((file) => {
					const filePath = path.join(testDir, file)
					if (fs.statSync(filePath).isFile()) {
						fs.unlinkSync(filePath)
					}
				})
			}
		} catch (err) {
			// Ignore cleanup errors
		}
	})

	it("computes consistent SHA-256 hashes for identical content", () => {
		const content = "export const feature = () => {}"
		const hash1 = ConcurrencyGuard.hashContent(content)
		const hash2 = ConcurrencyGuard.hashContent(content)

		expect(hash1).toBe(hash2)
		expect(hash1).toMatch(/^[a-f0-9]{64}$/) // SHA-256 = 64 hex chars
	})

	it("computes different SHA-256 hashes for different content", () => {
		const hash1 = ConcurrencyGuard.hashContent("content A")
		const hash2 = ConcurrencyGuard.hashContent("content B")

		expect(hash1).not.toBe(hash2)
	})

	it("records snapshot on file read with correct metadata", () => {
		const content = "initial content"
		const turnId = "turn-001"
		const intentId = "feat-test-feature"

		const snapshot = guard.recordSnapshot(testFilePath, content, turnId, intentId)

		expect(snapshot.file_path).toBe(testFilePath)
		expect(snapshot.read_hash).toBe(ConcurrencyGuard.hashContent(content))
		expect(snapshot.turn_id).toBe(turnId)
		expect(snapshot.intent_id).toBe(intentId)
		expect(snapshot.timestamp).toBeTruthy()
	})

	it("allows write when file is unmodified (hashes match)", () => {
		const content = "initial content"
		const turnId = "turn-001"

		// Record snapshot when reading
		guard.recordSnapshot(testFilePath, content, turnId)

		// Write to disk with same content (simulate the file is still the same)
		fs.writeFileSync(testFilePath, content, "utf8")

		// Verify write - should return null (no error)
		const error = guard.verifyBeforeWrite(testFilePath)
		expect(error).toBeNull()
	})

	it("blocks write with STALE_FILE error when file is modified", () => {
		const originalContent = "export const original = () => {}"
		const modifiedContent = "export const original = () => { /* comment */ }"
		const turnId = "turn-001"

		// Record snapshot with original content
		guard.recordSnapshot(testFilePath, originalContent, turnId)

		// Write modified content to disk (simulating external modification)
		fs.writeFileSync(testFilePath, modifiedContent, "utf8")

		// Verify write - should return STALE_FILE error
		const error = guard.verifyBeforeWrite(testFilePath)

		expect(error).not.toBeNull()
		expect(error?.type).toBe("STALE_FILE")
		expect(error?.file_path).toBe(testFilePath)
		expect(error?.message).toContain("modified since you read it")
		expect(error?.resolution).toContain("re-read the file")
	})

	it("allows write for new files without prior snapshot", () => {
		const newFilePath = "brand-new-file.ts"

		// No snapshot recorded
		const error = guard.verifyBeforeWrite(newFilePath)

		expect(error).toBeNull()

		// Cleanup
		try {
			if (fs.existsSync(newFilePath)) {
				fs.unlinkSync(newFilePath)
			}
		} catch {
			// Ignore
		}
	})

	it("allows write for files that existed during read but don't exist on disk anymore", () => {
		const content = "content"
		const turnId = "turn-001"

		// Record snapshot
		guard.recordSnapshot(testFilePath, content, turnId)

		// Delete the file from disk (concurrent deletion)
		try {
			if (fs.existsSync(testFilePath)) {
				fs.unlinkSync(testFilePath)
			}
		} catch {
			// File may not exist yet, that's OK
		}

		// Verify write - should allow write (can create new file)
		const error = guard.verifyBeforeWrite(testFilePath)
		expect(error).toBeNull()
	})

	it("clears snapshot for file after successful write", () => {
		const content = "content"
		const turnId = "turn-001"

		guard.recordSnapshot(testFilePath, content, turnId)
		expect(guard.getSnapshot(testFilePath)).toBeDefined()

		guard.clearSnapshot(testFilePath)
		expect(guard.getSnapshot(testFilePath)).toBeUndefined()
	})

	it("clears all snapshots for end-of-turn cleanup", () => {
		const turnId = "turn-001"

		guard.recordSnapshot("file1.ts", "content1", turnId)
		guard.recordSnapshot("file2.ts", "content2", turnId)
		guard.recordSnapshot("file3.ts", "content3", turnId)

		expect(guard.getAllSnapshots().length).toBe(3)

		guard.clearAllSnapshots()

		expect(guard.getAllSnapshots().length).toBe(0)
	})

	it("queries snapshots by turn ID", () => {
		const turn1 = "turn-001"
		const turn2 = "turn-002"

		guard.recordSnapshot("file1.ts", "content1", turn1)
		guard.recordSnapshot("file2.ts", "content2", turn1)
		guard.recordSnapshot("file3.ts", "content3", turn2)

		const turn1Snapshots = guard.getSnapshotsByTurn(turn1)
		expect(turn1Snapshots.length).toBe(2)
		expect(turn1Snapshots.every((s) => s.turn_id === turn1)).toBe(true)

		const turn2Snapshots = guard.getSnapshotsByTurn(turn2)
		expect(turn2Snapshots.length).toBe(1)
		expect(turn2Snapshots[0].turn_id).toBe(turn2)
	})

	it("queries snapshots by intent ID", () => {
		const intent1 = "feat-feature1"
		const intent2 = "feat-feature2"

		guard.recordSnapshot("file1.ts", "content1", "turn-1", intent1)
		guard.recordSnapshot("file2.ts", "content2", "turn-1", intent1)
		guard.recordSnapshot("file3.ts", "content3", "turn-2", intent2)

		const intent1Snapshots = guard.getSnapshotsByIntent(intent1)
		expect(intent1Snapshots.length).toBe(2)
		expect(intent1Snapshots.every((s) => s.intent_id === intent1)).toBe(true)
	})

	it("queries snapshots by file path", () => {
		const filePath = "important-file.ts"

		guard.recordSnapshot(filePath, "version1", "turn-1")
		guard.recordSnapshot(filePath, "version2", "turn-2")
		guard.recordSnapshot("other.ts", "content", "turn-3")

		const fileSnapshots = guard.getSnapshotsByFile(filePath)
		expect(fileSnapshots.length).toBe(2)
		expect(fileSnapshots.every((s) => s.file_path === filePath)).toBe(true)
	})

	it("persists snapshots to concurrency_snapshots.jsonl", () => {
		const snapshotPath = ".orchestration/concurrency_snapshots.jsonl"

		guard.recordSnapshot("file1.ts", "content1", "turn-1", "intent-1")
		guard.recordSnapshot("file2.ts", "content2", "turn-2", "intent-2")

		expect(fs.existsSync(snapshotPath)).toBe(true)

		const content = fs.readFileSync(snapshotPath, "utf8")
		const lines = content
			.trim()
			.split("\n")
			.filter((line) => line.length > 0)

		expect(lines.length).toBeGreaterThanOrEqual(2)

		// Verify JSONL format
		lines.forEach((line) => {
			expect(() => JSON.parse(line)).not.toThrow()
		})
	})

	it("recovers snapshots from log on initialization", () => {
		const snapshotPath = ".orchestration/concurrency_snapshots.jsonl"

		// Create a new guard and record snapshots
		const guard1 = new ConcurrencyGuard()
		guard1.recordSnapshot("file1.ts", "content1", "turn-1", "intent-1")
		guard1.recordSnapshot("file2.ts", "content2", "turn-2", "intent-2")

		// Create another guard instance (simulating app restart)
		const guard2 = new ConcurrencyGuard()

		// Should have loaded snapshots from file
		const snapshots = guard2.getAllSnapshots()
		expect(snapshots.length).toBeGreaterThanOrEqual(2)
	})

	it("produces correct STALE_FILE error with hashes", () => {
		const originalContent = "original"
		const modifiedContent = "modified content"

		guard.recordSnapshot(testFilePath, originalContent, "turn-1")
		fs.writeFileSync(testFilePath, modifiedContent, "utf8")

		const error = guard.verifyBeforeWrite(testFilePath)

		expect(error?.type).toBe("STALE_FILE")
		expect(error?.expected_hash).toBe(ConcurrencyGuard.hashContent(originalContent))
		expect(error?.current_hash).toBe(ConcurrencyGuard.hashContent(modifiedContent))
		expect(error?.expected_hash).not.toBe(error?.current_hash)
	})

	it("handles concurrent writes to different files without blocking", () => {
		const turn = "turn-001"

		guard.recordSnapshot("file1.ts", "content1", turn)
		guard.recordSnapshot("file2.ts", "content2", turn)

		fs.writeFileSync("file1.ts", "content1", "utf8")
		fs.writeFileSync("file2.ts", "content2", "utf8")

		const error1 = guard.verifyBeforeWrite("file1.ts")
		const error2 = guard.verifyBeforeWrite("file2.ts")

		expect(error1).toBeNull()
		expect(error2).toBeNull()

		// Cleanup
		try {
			fs.unlinkSync("file1.ts")
			fs.unlinkSync("file2.ts")
		} catch {
			// Ignore
		}
	})
})
