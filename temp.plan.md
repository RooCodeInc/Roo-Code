# Plan: Non-Destructive Sliding Window Truncation

> **Goal:** Make sliding window truncation rewindable by tagging messages instead of deleting them, mirroring the approach used for condensing.

## Background

### Current Behavior (Destructive)

When the context window fills up and condensing fails or is disabled, `truncateConversation()` in `src/core/context-management/index.ts` is called:

```typescript
export function truncateConversation(messages: ApiMessage[], fracToRemove: number, taskId: string): ApiMessage[] {
	const truncatedMessages = [messages[0]] // Keep first message (task)
	const messagesToRemove = Math.floor((messages.length - 1) * fracToRemove)
	const remainingMessages = messages.slice(messagesToRemove + 1)
	truncatedMessages.push(...remainingMessages)
	return truncatedMessages // Removed messages are LOST FOREVER
}
```

If the user later rewinds past a sliding window truncation point, those messages are gone forever.

### Desired Behavior (Non-Destructive)

Same approach as condensing:

1. Tag truncated messages with `truncationParent: <truncationId>` instead of removing them
2. `getEffectiveApiHistory()` filters out messages whose `truncationParent` points to an active truncation
3. When truncation is removed (via rewind), orphaned `truncationParent` tags are cleared
4. Messages become visible again

---

## Implementation Plan

### Step 1: Extend `ApiMessage` Type

**File:** `src/core/task-persistence/apiMessages.ts`

Add optional `truncationParent` field:

```typescript
export type ApiMessage = Anthropic.MessageParam & {
	ts?: number
	condenseId?: string // Existing - for summaries
	condenseParent?: string // Existing - for condensed messages
	truncationId?: string // NEW - for truncation markers
	truncationParent?: string // NEW - for truncated messages
	isSummary?: boolean
	isTruncationMarker?: boolean // NEW - identifies truncation boundary
}
```

### Step 2: Create Non-Destructive `truncateConversation()`

**File:** `src/core/context-management/index.ts`

Change from deleting messages to tagging them:

```typescript
export function truncateConversation(messages: ApiMessage[], fracToRemove: number, taskId: string): ApiMessage[] {
	TelemetryService.instance.captureSlidingWindowTruncation(taskId)

	const truncationId = crypto.randomUUID()
	const rawMessagesToRemove = Math.floor((messages.length - 1) * fracToRemove)
	const messagesToRemove = rawMessagesToRemove - (rawMessagesToRemove % 2)

	// Tag messages that are being "truncated" (hidden from API calls)
	const taggedMessages = messages.map((msg, index) => {
		if (index > 0 && index <= messagesToRemove) {
			return { ...msg, truncationParent: truncationId }
		}
		return msg
	})

	// Insert truncation marker after first message (so we know a truncation happened)
	const firstKeptTs = messages[messagesToRemove + 1]?.ts ?? Date.now()
	const truncationMarker: ApiMessage = {
		role: "assistant",
		content: `[Sliding window truncation: ${messagesToRemove} messages hidden to reduce context]`,
		ts: firstKeptTs - 1,
		isTruncationMarker: true,
		truncationId,
	}

	// Insert marker after first message
	const result = [taggedMessages[0], truncationMarker, ...taggedMessages.slice(1)]

	return result
}
```

Also return `truncationId` from `manageContext()` similar to how we return `condenseId`:

```typescript
export type ContextManagementResult = SummarizeResponse & {
	prevContextTokens: number
	truncationId?: string // NEW
}
```

### Step 3: Update `getEffectiveApiHistory()` to Filter Truncated Messages

**File:** `src/core/condense/index.ts`

Update to also filter by `truncationParent`:

```typescript
export function getEffectiveApiHistory(messages: ApiMessage[]): ApiMessage[] {
	const existingSummaryIds = new Set(messages.filter((m) => m.isSummary && m.condenseId).map((m) => m.condenseId))
	const existingTruncationIds = new Set(
		messages.filter((m) => m.isTruncationMarker && m.truncationId).map((m) => m.truncationId),
	)

	return messages.filter((msg) => {
		// Filter out condensed messages if their summary exists
		if (msg.condenseParent && existingSummaryIds.has(msg.condenseParent)) {
			return false
		}
		// Filter out truncated messages if their truncation marker exists
		if (msg.truncationParent && existingTruncationIds.has(msg.truncationParent)) {
			return false
		}
		return true
	})
}
```

### Step 4: Update `cleanupAfterTruncation()` to Handle Truncation Markers

**File:** `src/core/condense/index.ts`

```typescript
export function cleanupAfterTruncation(messages: ApiMessage[]): ApiMessage[] {
	// Find existing summary IDs
	const existingSummaryIds = new Set(messages.filter((m) => m.isSummary && m.condenseId).map((m) => m.condenseId))
	// Find existing truncation marker IDs
	const existingTruncationIds = new Set(
		messages.filter((m) => m.isTruncationMarker && m.truncationId).map((m) => m.truncationId),
	)

	return messages.map((msg) => {
		const updates: Partial<ApiMessage> = {}

		// Clear orphaned condenseParent
		if (msg.condenseParent && !existingSummaryIds.has(msg.condenseParent)) {
			updates.condenseParent = undefined
		}
		// Clear orphaned truncationParent
		if (msg.truncationParent && !existingTruncationIds.has(msg.truncationParent)) {
			updates.truncationParent = undefined
		}

		if (Object.keys(updates).length > 0) {
			const { condenseParent, truncationParent, ...rest } = msg
			return {
				...rest,
				...(updates.condenseParent === undefined ? {} : { condenseParent }),
				...(updates.truncationParent === undefined ? {} : { truncationParent }),
			}
		}
		return msg
	})
}
```

### Step 5: Add `sliding_window_truncation` ClineMessage Type

**File:** `packages/types/src/message.ts`

Add to `ClineSayTool` type:

```typescript
export type ClineSayTool =
	// ... existing types
	"sliding_window_truncation" // NEW
```

Add schema:

```typescript
export const contextTruncationSchema = z.object({
	truncationId: z.string(),
	messagesRemoved: z.number(),
	prevContextTokens: z.number(),
})

export type ContextTruncation = z.infer<typeof contextTruncationSchema>
```

Update `ClineMessage`:

```typescript
export type ClineMessage = {
	// ... existing fields
	contextTruncation?: ContextTruncation // NEW
}
```

### Step 6: Update Task.ts to Create UI Event for Truncation

**File:** `src/core/task/Task.ts`

When `manageContext()` returns a truncation result, create a UI event:

```typescript
// After manageContext() returns...
if (result.truncationId) {
  const contextTruncation: ContextTruncation = {
    truncationId: result.truncationId,
    messagesRemoved: /* calculate from result */,
    prevContextTokens: result.prevContextTokens,
  }
  await this.say("sliding_window_truncation", undefined, undefined, false, undefined, undefined,
    { isNonInteractive: true }, undefined, contextTruncation)
}
```

### Step 7: Update `removeMessagesThisAndSubsequent()` to Sync Truncation Removal

**File:** `src/core/webview/webviewMessageHandler.ts`

Similar to how we handle `condense_context` removal:

```typescript
const removeMessagesThisAndSubsequent = async (...) => {
  // Collect condenseIds from removed condense_context messages
  const removedCondenseIds = new Set<string>()
  // Collect truncationIds from removed sliding_window_truncation messages
  const removedTruncationIds = new Set<string>()

  for (let i = messageIndex; i < currentCline.clineMessages.length; i++) {
    const msg = currentCline.clineMessages[i]
    if (msg.say === "condense_context" && msg.contextCondense?.condenseId) {
      removedCondenseIds.add(msg.contextCondense.condenseId)
    }
    if (msg.say === "sliding_window_truncation" && msg.contextTruncation?.truncationId) {
      removedTruncationIds.add(msg.contextTruncation.truncationId)
    }
  }

  // ... truncate clineMessages ...

  if (apiConversationHistoryIndex !== -1) {
    let truncatedApiHistory = currentCline.apiConversationHistory.slice(0, apiConversationHistoryIndex)

    // Remove orphaned Summaries
    if (removedCondenseIds.size > 0) {
      truncatedApiHistory = truncatedApiHistory.filter(msg => {
        if (msg.isSummary && msg.condenseId && removedCondenseIds.has(msg.condenseId)) {
          return false
        }
        return true
      })
    }

    // Remove orphaned Truncation Markers
    if (removedTruncationIds.size > 0) {
      truncatedApiHistory = truncatedApiHistory.filter(msg => {
        if (msg.isTruncationMarker && msg.truncationId && removedTruncationIds.has(msg.truncationId)) {
          return false
        }
        return true
      })
    }

    const cleanedApiHistory = cleanupAfterTruncation(truncatedApiHistory)
    await currentCline.overwriteApiConversationHistory(cleanedApiHistory)
  }
}
```

### Step 8: Add Tests

**File:** `src/core/context-management/__tests__/truncation.spec.ts` (new file)

Test cases:

- `truncateConversation()` should tag messages with `truncationParent` instead of deleting
- `truncateConversation()` should insert truncation marker with `truncationId`
- `getEffectiveApiHistory()` should filter truncated messages
- `cleanupAfterTruncation()` should clear orphaned `truncationParent` tags
- Rewind past truncation should restore hidden messages

---

## Quick Implementation Checklist

- [ ] **Step 1:** Add `truncationId` and `truncationParent` fields to `ApiMessage` type
- [ ] **Step 2:** Update `truncateConversation()` to tag instead of delete, return `truncationId`
- [ ] **Step 3:** Update `getEffectiveApiHistory()` to filter by `truncationParent`
- [ ] **Step 4:** Update `cleanupAfterTruncation()` to handle `truncationParent`
- [ ] **Step 5:** Add `sliding_window_truncation` clineMessage type and `ContextTruncation` schema
- [ ] **Step 6:** Update Task.ts to create UI event when truncation happens
- [ ] **Step 7:** Update `removeMessagesThisAndSubsequent()` to sync truncation removal
- [ ] **Step 8:** Add tests for non-destructive truncation behavior

---

## Files to Modify Summary

| File                                                       | Change                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/core/task-persistence/apiMessages.ts`                 | Add `truncationId`, `truncationParent`, `isTruncationMarker` fields    |
| `src/core/context-management/index.ts`                     | Update `truncateConversation()` to tag messages, return `truncationId` |
| `src/core/condense/index.ts`                               | Update `getEffectiveApiHistory()` and `cleanupAfterTruncation()`       |
| `packages/types/src/message.ts`                            | Add `sliding_window_truncation` type, `ContextTruncation` schema       |
| `src/core/task/Task.ts`                                    | Create UI event when truncation happens                                |
| `src/core/webview/webviewMessageHandler.ts`                | Sync truncation marker removal                                         |
| `src/core/context-management/__tests__/truncation.spec.ts` | New test file                                                          |

---

## Backward Compatibility

- Existing tasks without `truncationParent` fields work correctly (fields are optional)
- Old truncated messages are already lost (can't restore them retroactively)
- New truncations will be rewindable
