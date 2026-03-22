import type { Observation, MemoryCategorySlug } from "./types"
import { MEMORY_CONSTANTS, DEFAULT_MEMORY_CATEGORIES } from "./types"
import type { MemoryStore } from "./memory-store"

const PII_PATTERNS = [
	/\S+@\S+\.\S+/,
	/sk-[a-zA-Z0-9]{20,}/,
	/ghp_[a-zA-Z0-9]{36}/,
	/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
	/\b\d{3}-\d{2}-\d{4}\b/,
	/AKIA[0-9A-Z]{16}/,
	/-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
]

/** Return true if content matches any known PII/secret pattern. */
export function containsPII(content: string): boolean {
	return PII_PATTERNS.some((pattern) => pattern.test(content))
}

/** Compute Jaccard similarity between two strings (word-level, case-insensitive). */
export function jaccardSimilarity(a: string, b: string): number {
	const tokenize = (s: string) =>
		new Set(
			s
				.toLowerCase()
				.split(/\s+/)
				.filter((w) => w.length > 2),
		)
	const setA = tokenize(a)
	const setB = tokenize(b)
	if (setA.size === 0 && setB.size === 0) return 1.0
	if (setA.size === 0 || setB.size === 0) return 0.0
	const intersection = new Set(Array.from(setA).filter((x) => setB.has(x)))
	const union = new Set([...Array.from(setA), ...Array.from(setB)])
	return intersection.size / union.size
}

// Categories that are always global
const GLOBAL_CATEGORIES = new Set<MemoryCategorySlug>([
	"coding-style",
	"communication-prefs",
	"dislikes-frustrations",
])

// Categories that are always workspace-scoped
const WORKSPACE_CATEGORIES = new Set<MemoryCategorySlug>(["active-projects"])

function getDecayRate(category: MemoryCategorySlug): number {
	const cat = DEFAULT_MEMORY_CATEGORIES.find((c) => c.slug === category)
	return cat?.defaultDecayRate ?? 0.1
}

export interface WriteResult {
	entriesCreated: number
	entriesReinforced: number
	entriesSkipped: number
}

/** Write validated observations into the store with PII filtering and dedup. */
export function processObservations(
	store: MemoryStore,
	observations: Observation[],
	workspaceId: string | null,
	taskId: string | null,
): WriteResult {
	let created = 0
	let reinforced = 0
	let skipped = 0
	const now = Math.floor(Date.now() / 1000)

	for (const obs of observations) {
		// PII filter
		if (containsPII(obs.content)) {
			skipped++
			continue
		}

		if (obs.action === "NEW") {
			// Determine scope
			let entryWorkspaceId: string | null = null
			if (WORKSPACE_CATEGORIES.has(obs.category)) {
				entryWorkspaceId = workspaceId
			} else if (!GLOBAL_CATEGORIES.has(obs.category)) {
				// Heuristic: if content mentions paths, it's workspace-scoped
				entryWorkspaceId = /[/\\]/.test(obs.content) ? workspaceId : null
			}

			// Dedup check
			const existing = store.getEntriesByCategory(obs.category, entryWorkspaceId)
			const duplicate = existing.find(
				(e) => jaccardSimilarity(e.content, obs.content) >= MEMORY_CONSTANTS.DEDUP_SIMILARITY_THRESHOLD,
			)

			if (duplicate) {
				store.reinforceEntry(duplicate.id, taskId)
				reinforced++
			} else {
				store.insertEntry({
					workspaceId: entryWorkspaceId,
					category: obs.category,
					content: obs.content,
					significance: obs.significance,
					firstSeen: now,
					lastReinforced: now,
					reinforcementCount: 1,
					decayRate: getDecayRate(obs.category),
					sourceTaskId: taskId,
					isPinned: false,
				})
				created++
			}
		} else if (obs.action === "REINFORCE") {
			if (obs.existingEntryId) {
				const entry = store.getEntry(obs.existingEntryId)
				if (entry && entry.category === obs.category) {
					store.reinforceEntry(obs.existingEntryId, taskId)
					reinforced++
				} else {
					skipped++ // Invalid ID — skip silently
				}
			} else {
				skipped++
			}
		} else if (obs.action === "UPDATE") {
			if (obs.existingEntryId) {
				const entry = store.getEntry(obs.existingEntryId)
				if (entry && entry.category === obs.category) {
					store.updateEntry(obs.existingEntryId, obs.content, obs.significance, taskId)
					reinforced++
				} else {
					// Invalid ID — treat as NEW with dedup check
					const existing = store.getEntriesByCategory(obs.category, workspaceId)
					const duplicate = existing.find(
						(e) => jaccardSimilarity(e.content, obs.content) >= MEMORY_CONSTANTS.DEDUP_SIMILARITY_THRESHOLD,
					)
					if (duplicate) {
						store.updateEntry(duplicate.id, obs.content, obs.significance, taskId)
						reinforced++
					} else {
						store.insertEntry({
							workspaceId: WORKSPACE_CATEGORIES.has(obs.category) ? workspaceId : null,
							category: obs.category,
							content: obs.content,
							significance: obs.significance,
							firstSeen: now,
							lastReinforced: now,
							reinforcementCount: 1,
							decayRate: getDecayRate(obs.category),
							sourceTaskId: taskId,
							isPinned: false,
						})
						created++
					}
				}
			} else {
				skipped++
			}
		}
	}

	return { entriesCreated: created, entriesReinforced: reinforced, entriesSkipped: skipped }
}
