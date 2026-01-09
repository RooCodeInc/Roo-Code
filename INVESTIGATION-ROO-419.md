# Investigation: ROO-419 - Roo shows project root as edit target when pathname lags

## Issue Description

User occasionally sees Roo showing "wants to edit this file" with the project root selected instead of a specific file. In these cases, the edit step takes a very long time before the actual intended file edit occurs.

This is related to the order of native tool calling (NTC) arguments: the streamed content arrives before the pathname, so the UI temporarily renders the root as the target until the pathname is received.

## Root Cause Analysis

### 1. Native Tool Call Streaming Flow

When using native tool calling, the API streams JSON arguments incrementally:

```json
// First chunk - content arrives first
{"content": "function hello() {\n  return 'world';\n}"}

// Second chunk - path arrives later
{"content": "function hello() {\n  return 'world';\n}", "path": "src/hello.ts"}
```

### 2. Code Flow

#### A. NativeToolCallParser.createPartialToolUse() 
**Location**: [`Roo-Code/src/core/assistant-message/NativeToolCallParser.ts:344-564`](Roo-Code/src/core/assistant-message/NativeToolCallParser.ts:344)

This function creates partial ToolUse objects as JSON streams in. The problem occurs here:

**For `write_to_file` (lines 387-394):**
```typescript
case "write_to_file":
    if (partialArgs.path || partialArgs.content) {
        nativeArgs = {
            path: partialArgs.path,      // ⚠️ Can be undefined!
            content: partialArgs.content,
        }
    }
    break;
```

**For `apply_diff` (lines 405-412):**
```typescript
case "apply_diff":
    if (partialArgs.path !== undefined || partialArgs.diff !== undefined) {
        nativeArgs = {
            path: partialArgs.path,  // ⚠️ Can be undefined!
            diff: partialArgs.diff,
        }
    }
    break;
```

**Problem**: The condition allows nativeArgs creation even when only `content`/`diff` is present but `path` is undefined. This creates a partial ToolUse with incomplete data.

#### B. ChatRow.tsx
**Location**: [`Roo-Code/webview-ui/src/components/chat/ChatRow.tsx:427-459`](Roo-Code/webview-ui/src/components/chat/ChatRow.tsx:427)

Renders the file edit UI using `tool.path` from the partial ToolUse:

```tsx
<CodeAccordian
    path={tool.path}  // ⚠️ Can be undefined from partial update
    code={unifiedDiff ?? tool.content ?? tool.diff}
    // ...
/>
```

**Problem**: No check for undefined path before rendering, so the component renders with incomplete data.

#### C. CodeAccordian.tsx
**Location**: [`Roo-Code/webview-ui/src/components/common/CodeAccordian.tsx:27-131`](Roo-Code/webview-ui/src/components/common/CodeAccordian.tsx:27)

Receives the `path` prop and formats it for display:

```tsx
<PathTooltip content={formatPathTooltip(path)}>
    <span className="whitespace-nowrap overflow-hidden text-ellipsis text-left mr-2 rtl">
        {formatPathTooltip(path)}
    </span>
</PathTooltip>
```

**Problem**: When path is undefined, `formatPathTooltip` returns an empty string, causing the UI to show no file target or the project root.

#### D. formatPathTooltip.ts
**Location**: [`Roo-Code/webview-ui/src/utils/formatPathTooltip.ts:18-19`](Roo-Code/webview-ui/src/utils/formatPathTooltip.ts:18)

```typescript
export function formatPathTooltip(path?: string, additionalContent?: string): string {
    if (!path) return ""  // ⚠️ Returns empty string for undefined path
    // ...
}
```

**Problem**: Returns empty string when path is undefined, which results in empty/root directory display in UI.

## Impact

1. **Confusing UX**: Users see "wants to edit this file" with the project root selected, not understanding what file will be modified
2. **Long perceived wait times**: The UI appears frozen/unresponsive while waiting for the pathname to arrive
3. **Trust issues**: Users may not trust what Roo is doing when they see incorrect file targets

## Solution Approaches

### Option 1: Delay Rendering Until Path Arrives ⭐ (Recommended)

**Strategy**: Don't create partial nativeArgs for file editing tools until the required `path` parameter is present.

**Changes needed**: Modify [`NativeToolCallParser.createPartialToolUse()`](Roo-Code/src/core/assistant-message/NativeToolCallParser.ts:387) conditions:

```typescript
case "write_to_file":
    // Only create nativeArgs when BOTH path and content are present
    if (partialArgs.path && partialArgs.content) {
        nativeArgs = {
            path: partialArgs.path,
            content: partialArgs.content,
        }
    }
    break;

case "apply_diff":
    // Only create nativeArgs when BOTH path and diff are present
    if (partialArgs.path && partialArgs.diff) {
        nativeArgs = {
            path: partialArgs.path,
            diff: partialArgs.diff,
        }
    }
    break;
```

**Pros**:
- Simple fix with minimal code changes
- Prevents confusing UI states entirely
- No new UI components needed
- Matches user expectations (don't show incomplete information)

**Cons**:
- User sees no visual feedback until path arrives
- May feel slightly less responsive (but more accurate)

### Option 2: Show "Loading..." Indicator

**Strategy**: Render a loading state when content is present but path is undefined.

**Changes needed**: Modify [`ChatRow.tsx`](Roo-Code/webview-ui/src/components/chat/ChatRow.tsx:446) or [`CodeAccordian.tsx`](Roo-Code/webview-ui/src/components/common/CodeAccordian.tsx:74) to detect missing path and show loading indicator.

**Pros**:
- Provides immediate visual feedback
- Shows that something is happening
- More responsive feel

**Cons**:
- Requires new UI component/state
- More complex implementation
- Still shows incomplete information (loading instead of target)

### Option 3: Suppress Partial Updates for File Tools

**Strategy**: Don't emit partial ToolUse updates for tools that require a path parameter.

**Changes needed**: Add logic to [`processStreamingChunk`](Roo-Code/src/core/assistant-message/NativeToolCallParser.ts:234) to suppress partial updates for specific tools.

**Pros**:
- Completely prevents the issue at the source
- Clear separation between tools that support partial rendering vs. those that don't

**Cons**:
- No visual feedback during streaming
- Requires tool categorization/configuration
- More significant code changes

## Recommendation

**Option 1** is the best approach because:

1. **Simplest implementation**: Single logical condition change in one function
2. **Prevents bad UX**: Users never see incorrect/incomplete information
3. **No new UI needed**: Leverages existing rendering flow
4. **Consistent behavior**: Aligns with how other tools handle required parameters
5. **Easy to test**: Clear before/after behavior

The fix should be applied in [`NativeToolCallParser.createPartialToolUse()`](Roo-Code/src/core/assistant-message/NativeToolCallParser.ts:344) by requiring BOTH path and content/diff to be present before creating nativeArgs for file editing tools.

## Files to Modify

1. **Primary Fix**: [`Roo-Code/src/core/assistant-message/NativeToolCallParser.ts`](Roo-Code/src/core/assistant-message/NativeToolCallParser.ts)
   - Line 387-394: `write_to_file` case
   - Line 405-412: `apply_diff` case

## Testing Considerations

1. Test with a model that uses native tool calling
2. Verify that file edits don't show UI until path is present
3. Ensure other tools (without required path) still show partial updates correctly
4. Check that final rendering works correctly once path arrives
5. Test with slow network conditions to simulate delayed path arrival
