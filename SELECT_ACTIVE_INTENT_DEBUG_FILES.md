# Files Related to `select_active_intent` Parsing Error

## Core Issue

The error: `[NativeToolCallParser] Invalid arguments for tool 'select_active_intent'. Native tool calls require a valid JSON payload matching the tool schema. Received: {"intent_id":"INT-008"}`

The arguments look correct, but the parser is failing to create `nativeArgs`. This suggests the validation logic in the switch statement is failing.

## Critical Files to Review

### 1. **NativeToolCallParser.ts** (Main Parser)

**Path:** `src/core/assistant-message/NativeToolCallParser.ts`

- **Lines 721-770:** JSON parsing logic (handles concatenated JSON, double-stringify)
- **Lines 1045-1050:** `select_active_intent` case in the switch statement
- **Lines 1115-1122:** Error handling/catch block
- **Key Issue:** Check if `args.intent_id !== undefined` validation is working correctly

### 2. **tools.ts** (Type Definitions)

**Path:** `src/shared/tools.ts`

- **Line 84:** `intent_id` in `toolParamNames` array
- **Line 125:** `select_active_intent: { intent_id: string }` in `NativeToolArgs`
- **Key Issue:** Verify `intent_id` is properly included in the compiled code

### 3. **SelectActiveIntentTool.ts** (Tool Implementation)

**Path:** `src/hooks/SelectActiveIntentTool.ts`

- **Lines 18-106:** `execute()` method that receives parameters
- **Line 19:** `const { intent_id } = params` - expects `intent_id` from params
- **Key Issue:** Tool expects `nativeArgs` to contain `intent_id`

### 4. **BaseTool.ts** (Base Class)

**Path:** `src/core/tools/BaseTool.ts`

- **Lines 128-157:** Parameter extraction logic
- **Line 131:** `if (block.nativeArgs !== undefined)` - checks for nativeArgs
- **Line 148:** Throws error if `nativeArgs` is missing
- **Key Issue:** If parser doesn't create `nativeArgs`, this will fail

### 5. **presentAssistantMessage.ts** (Tool Execution)

**Path:** `src/core/assistant-message/presentAssistantMessage.ts`

- **Lines 702-708:** `select_active_intent` case in switch statement
- **Key Issue:** Calls `selectActiveIntentTool.handle()` with the block

### 6. **select_active_intent.ts** (Tool Definition for LLM)

**Path:** `src/core/prompts/tools/native-tools/select_active_intent.ts`

- **Lines 1-27:** OpenAI function definition
- **Key Issue:** Defines the schema the LLM should follow

## Debugging Steps

1. **Check if `args` object is created correctly:**

    - In `NativeToolCallParser.ts` line 725, verify `JSON.parse()` succeeds
    - Check if concatenated JSON fix is working (lines 726-753)

2. **Check if `nativeArgs` is created:**

    - In `NativeToolCallParser.ts` line 1047, verify `args.intent_id !== undefined` passes
    - Add console.log to see what `args` contains at this point

3. **Check if validation fails:**

    - In `NativeToolCallParser.ts` line 1041, verify `nativeArgs` is not undefined
    - The error is thrown at line 1042-1046 if `nativeArgs` is undefined

4. **Verify compiled code:**
    - Check `src/dist/extension.js` to ensure fixes are compiled
    - Search for `select_active_intent` case in compiled code

## Potential Root Causes

1. **Parser not creating `nativeArgs`:**

    - The switch case validation `args.intent_id !== undefined` might be failing
    - `args` might be empty object `{}` instead of `{intent_id: "INT-008"}`

2. **Type mismatch:**

    - `args.intent_id` might be `null` or empty string instead of a valid string
    - Check if `args.intent_id` is truthy, not just defined

3. **Compilation issue:**

    - The fixes might not be in the compiled `extension.js`
    - Need to rebuild: `cd src && node esbuild.mjs`

4. **Extension host using old code:**
    - Extension Development Host might be running cached code
    - Need to fully restart (close all Extension Development Host windows, press F5)

## Quick Fix to Try

In `NativeToolCallParser.ts` around line 1047, change:

```typescript
case "select_active_intent":
    if (args.intent_id !== undefined) {
        nativeArgs = {
            intent_id: args.intent_id,
        } as NativeArgsFor<TName>
    }
    break
```

To:

```typescript
case "select_active_intent":
    if (args.intent_id !== undefined && args.intent_id !== null && args.intent_id !== "") {
        nativeArgs = {
            intent_id: String(args.intent_id),
        } as NativeArgsFor<TName>
    }
    break
```

This adds more robust validation and ensures `intent_id` is a non-empty string.
