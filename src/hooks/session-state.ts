/**
 * Session State Management for Intent Tracking
 *
 * This module manages session-level state for active intents. It provides
 * persistent storage of which intent is currently active for each session,
 * enabling PreToolUse hooks to validate scope and enforce constraints.
 *
 * Storage Strategy:
 * - In-memory Map for fast access
 * - Can be extended to persist to disk or VSCode extension state
 * - Session ID typically maps to Task ID
 */

import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"

/**
 * Session state structure
 */
interface SessionState {
	intentId: string
	timestamp: number
	metadata?: Record<string, unknown>
}

/**
 * In-memory session state storage
 * Maps sessionId → SessionState
 */
const sessionStateMap = new Map<string, SessionState>()

/**
 * Optional persistent storage path
 * If set, state will be persisted to disk
 */
let persistencePath: string | null = null

/**
 * Initialize session state management with optional persistence
 *
 * @param workspaceRoot - Workspace root directory for persistence
 * @returns void
 *
 * @example
 * await initSessionState("/workspace")
 * // State will be saved to /workspace/.orchestration/session_state.json
 */
export async function initSessionState(workspaceRoot?: string): Promise<void> {
	if (workspaceRoot) {
		persistencePath = path.join(workspaceRoot, ".orchestration", "session_state.json")
		await loadPersistedState()
	}
}

/**
 * Set the active intent ID for a session
 *
 * @param sessionId - The session/task identifier
 * @param intentId - The intent ID to set as active
 * @returns Promise that resolves when state is saved
 *
 * @example
 * await setSessionIntent("task-123", "INT-001")
 */
export async function setSessionIntent(sessionId: string, intentId: string): Promise<void> {
	const state: SessionState = {
		intentId,
		timestamp: Date.now(),
	}

	sessionStateMap.set(sessionId, state)

	// Persist to disk if enabled
	if (persistencePath) {
		await persistState()
	}
}

/**
 * Get the active intent ID for a session
 *
 * @param sessionId - The session/task identifier
 * @returns The active intent ID, or null if not set
 *
 * @example
 * const intentId = await getSessionIntent("task-123")
 * if (intentId) {
 *   console.log("Active intent:", intentId)
 * }
 */
export async function getSessionIntent(sessionId: string): Promise<string | null> {
	const state = sessionStateMap.get(sessionId)
	return state?.intentId ?? null
}

/**
 * Clear the active intent for a session
 *
 * @param sessionId - The session/task identifier
 * @returns Promise that resolves when state is cleared
 *
 * @example
 * await clearSessionIntent("task-123")
 */
export async function clearSessionIntent(sessionId: string): Promise<void> {
	sessionStateMap.delete(sessionId)

	// Persist to disk if enabled
	if (persistencePath) {
		await persistState()
	}
}

/**
 * Get all active sessions with their intent IDs
 *
 * @returns Map of sessionId → intentId
 *
 * @example
 * const sessions = getAllSessions()
 * for (const [sessionId, intentId] of sessions) {
 *   console.log(`Session ${sessionId} has intent ${intentId}`)
 * }
 */
export function getAllSessions(): Map<string, string> {
	const result = new Map<string, string>()
	for (const [sessionId, state] of sessionStateMap.entries()) {
		result.set(sessionId, state.intentId)
	}
	return result
}

/**
 * Clear all session state (useful for testing or reset)
 *
 * @returns Promise that resolves when all state is cleared
 *
 * @example
 * await clearAllSessions()
 */
export async function clearAllSessions(): Promise<void> {
	sessionStateMap.clear()

	if (persistencePath) {
		await persistState()
	}
}

/**
 * Load persisted state from disk
 * @private
 */
async function loadPersistedState(): Promise<void> {
	if (!persistencePath) return

	try {
		const data = await fs.readFile(persistencePath, "utf-8")
		const parsed = JSON.parse(data) as Record<string, SessionState>

		// Load into in-memory map
		for (const [sessionId, state] of Object.entries(parsed)) {
			sessionStateMap.set(sessionId, state)
		}
	} catch (error) {
		// File doesn't exist yet or is corrupted - start fresh
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			console.error("[SessionState] Failed to load persisted state:", error)
		}
	}
}

/**
 * Persist current state to disk
 * @private
 */
async function persistState(): Promise<void> {
	if (!persistencePath) return

	try {
		// Ensure directory exists
		const dir = path.dirname(persistencePath)
		await fs.mkdir(dir, { recursive: true })

		// Convert Map to plain object
		const obj: Record<string, SessionState> = {}
		for (const [sessionId, state] of sessionStateMap.entries()) {
			obj[sessionId] = state
		}

		// Write to disk
		await fs.writeFile(persistencePath, JSON.stringify(obj, null, 2), "utf-8")
	} catch (error) {
		console.error("[SessionState] Failed to persist state:", error)
	}
}

/**
 * Get session state with metadata
 *
 * @param sessionId - The session/task identifier
 * @returns Full session state object or null
 *
 * @example
 * const state = getSessionState("task-123")
 * if (state) {
 *   console.log("Intent:", state.intentId)
 *   console.log("Set at:", new Date(state.timestamp))
 * }
 */
export function getSessionState(sessionId: string): SessionState | null {
	return sessionStateMap.get(sessionId) ?? null
}

/**
 * Update session metadata without changing intent ID
 *
 * @param sessionId - The session/task identifier
 * @param metadata - Additional metadata to store
 * @returns Promise that resolves when metadata is updated
 *
 * @example
 * await updateSessionMetadata("task-123", { modelId: "claude-3-5-sonnet", filesModified: 5 })
 */
export async function updateSessionMetadata(sessionId: string, metadata: Record<string, unknown>): Promise<void> {
	const state = sessionStateMap.get(sessionId)
	if (state) {
		state.metadata = { ...state.metadata, ...metadata }
		sessionStateMap.set(sessionId, state)

		if (persistencePath) {
			await persistState()
		}
	}
}
