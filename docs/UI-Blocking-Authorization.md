# UI-Blocking Authorization Explained

## What is UI-Blocking Authorization?

**UI-Blocking Authorization** is a security mechanism that **pauses the execution flow** and **waits for explicit user approval** before allowing a potentially dangerous operation to proceed. The term "blocking" means the code execution **stops and waits** until the user responds - it cannot continue until the user makes a decision.

## Key Characteristics

### 1. **Execution Pauses**

- The JavaScript Promise chain **stops** at the authorization point
- No code executes until the user responds
- The entire extension waits for user input

### 2. **Modal Dialog**

- A dialog appears that **must be dismissed** before continuing
- User cannot interact with other parts of the application
- Forces explicit decision: Approve or Reject

### 3. **Synchronous Decision**

- The authorization function returns a boolean (`true`/`false`)
- Code flow branches based on the user's decision
- If rejected, operation is cancelled immediately

## How It Works in Your Hook System

### Current Flow (Without UI-Blocking Authorization)

```
Agent wants to write file
  ↓
Pre-Hook checks intent (automatic, no user input)
  ↓
Tool executes immediately
  ↓
User sees result after the fact
```

### With UI-Blocking Authorization

```
Agent wants to write file
  ↓
Pre-Hook checks intent
  ↓
⚠️ SHOW MODAL DIALOG - EXECUTION PAUSES ⚠️
  ↓
User sees: "Intent Evolution Request: INT-001 wants to modify src/auth.ts"
  ↓
User clicks: [Approve] or [Reject]
  ↓
IF APPROVED: Tool executes
IF REJECTED: Operation cancelled, error sent to LLM
```

## Implementation Example

### Non-Blocking (Current System)

```typescript
// This doesn't block - execution continues immediately
async function checkPermission() {
	// Some validation logic
	return true // Returns immediately
}

// Code continues regardless
await checkPermission()
doSomething() // Executes right away
```

### UI-Blocking (What You Need)

```typescript
// This BLOCKS - execution waits for user
async function requestApproval(): Promise<boolean> {
	// Show modal dialog - execution STOPS here
	const answer = await vscode.window.showWarningMessage(
		"Approve this operation?",
		{ modal: true }, // ← This makes it BLOCKING
		"Approve",
		"Reject",
	)

	// Code only reaches here AFTER user clicks a button
	return answer === "Approve"
}

// Execution PAUSES at this line
const approved = await requestApproval()

// This only runs AFTER user responds
if (approved) {
	doSomething()
} else {
	cancelOperation()
}
```

## Why "Blocking" Matters

### Without Blocking (Non-Modal)

```typescript
// Dialog appears but code continues
vscode.window.showWarningMessage("Warning!") // Returns immediately
doSomething() // Executes while dialog is still showing!
```

### With Blocking (Modal)

```typescript
// Dialog appears and code STOPS
const answer = await vscode.window.showWarningMessage(
	"Warning!",
	{ modal: true }, // Code waits here
)
// Code only continues after user clicks
doSomething() // Only runs after dialog is dismissed
```

## In Your Architecture Specification

From `document.md` line 156:

> **UI-Blocking Authorization:** Identify existing logic to pause the Promise chain. Your hook will trigger `vscode.window.showWarningMessage` with "Approve/Reject" to update core intent evolution.

This means:

1. **Pause the Promise chain**: Use `await` with a modal dialog
2. **Trigger showWarningMessage**: Use VS Code's built-in dialog
3. **Approve/Reject buttons**: Give user explicit choices
4. **Update intent evolution**: Only proceed if user approves the intent change

## Real-World Analogy

Think of it like a **security checkpoint**:

- **Non-blocking**: Security guard shouts "Stop!" but you keep walking
- **Blocking**: Security guard physically blocks the path - you **must** stop and show ID before proceeding

## Implementation in HookEngine

Here's how it works in your `preHook`:

```typescript
async preHook(toolName: ToolName, toolUse: ToolUse, task: Task): Promise<HookResult> {
  // ... validation checks ...

  // ⚠️ BLOCKING POINT - Execution stops here
  const approved = await vscode.window.showWarningMessage(
    `Intent ${intentId} wants to ${toolName}`,
    { modal: true },  // ← This makes it blocking
    "Approve",
    "Reject"
  )

  // Code only reaches here AFTER user clicks
  if (approved === "Approve") {
    return { shouldProceed: true }
  } else {
    return {
      shouldProceed: false,
      errorMessage: "Operation rejected by user"
    }
  }
}
```

## Key Difference from Current System

### Current Roo Code Approval System

- Uses webview-based approval (non-blocking in extension host)
- Can be auto-approved based on settings
- Approval happens in the UI layer, not in the hook

### Your Hook System (UI-Blocking)

- Uses VS Code native modal dialog (truly blocking)
- Happens **before** tool execution (in pre-hook)
- **Cannot** be bypassed - user must explicitly approve
- Execution **stops** until user responds

## Benefits

1. **Security**: User cannot accidentally approve dangerous operations
2. **Control**: User has explicit control over intent evolution
3. **Transparency**: User sees exactly what intent is requesting
4. **Trust**: Builds trust by requiring explicit approval for changes

## Summary

**UI-Blocking Authorization** = A modal dialog that **stops code execution** until the user explicitly approves or rejects an operation. It's the difference between:

- ❌ "Here's a notification, but I'll continue anyway"
- ✅ "STOP. You must approve before I continue"

In your hook system, this ensures that **no code changes happen** without explicit user approval for intent evolution.
