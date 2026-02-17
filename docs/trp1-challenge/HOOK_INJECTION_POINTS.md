# Hook Injection Points - Technical Specification

## Overview

This document identifies the exact locations where hooks will be injected into the Roo Code architecture to enable Intent-Code Traceability.

---

## 1. Primary Hook Locations

### 1.1 Task.processToolUse() - Main Injection Point

**File**: `src/core/task/Task.ts`

**Current Code** (Approximate):

```typescript
async processToolUse(block: ToolUse) {
    const toolName = block.name
    const tool = this.getToolInstance(toolName)

    if (!tool) {
        // Handle unknown tool
        return
    }

    // Direct execution - NO HOOKS
    await tool.handle(this, block, {
        askApproval: this.askApproval.bind(this),
        handleError: this.handleError.bind(this),
        pushToolResult: this.pushToolResult.bind(this),
        toolCallId: block.id,
    })
}
```

**Modified Code with Hooks**:

```typescript
async processToolUse(block: ToolUse) {
    const toolName = block.name
    const tool = this.getToolInstance(toolName)

    if (!tool) {
        return
    }

    // 🎣 PRE-HOOK: Intercept before execution
    const hookEngine = HookEngine.getInstance()
    const preHookResult = await hookEngine.executePreHook({
        toolName,
        params: block.nativeArgs,
        task: this,
        block,
    })

    // If pre-hook blocks execution
    if (preHookResult.blocked) {
        await this.say('tool_blocked', preHookResult.reason)
        return
    }

    // Inject enhanced context from pre-hook
    if (preHookResult.contextInjection) {
        // Add to next LLM call
        this.additionalContext = preHookResult.contextInjection
    }

    // Original execution with enhanced callbacks
    await tool.handle(this, block, {
        askApproval: this.askApproval.bind(this),
        handleError: this.handleError.bind(this),
        pushToolResult: async (result) => {
            // Original push
            await this.pushToolResult(result)

            // 🎣 POST-HOOK: After tool execution
            await hookEngine.executePostHook({
                toolName,
                params: block.nativeArgs,
                result,
                task: this,
                block,
            })
        },
        toolCallId: block.id,
    })
}
```

---

## 2. System Prompt Injection Point

### 2.1 System Prompt Construction

**File**: `src/core/prompts/system.ts`

**Current Structure**:

```typescript
export function getSystemPrompt(options: SystemPromptOptions): string {
	return `
        ${baseInstructions}
        ${toolDefinitions}
        ${modeRules}
        ${customRules}
    `
}
```

**Modified with Intent Context**:

```typescript
export function getSystemPrompt(options: SystemPromptOptions): string {
	// 🎣 HOOK: Load active intent context
	const intentContext = IntentManager.getActiveIntentContext(options.task)

	return `
        ${baseInstructions}
        ${toolDefinitions}
        ${modeRules}
        ${customRules}
        
        ${
			intentContext
				? `
        <intent_context>
        You are currently working on Intent: ${intentContext.id}
        Name: ${intentContext.name}
        
        Scope Restrictions:
        ${intentContext.owned_scope.map((s) => `- ${s}`).join("\n")}
        
        Constraints:
        ${intentContext.constraints.map((c) => `- ${c}`).join("\n")}
        
        IMPORTANT: You MUST call select_active_intent("${intentContext.id}") 
        before making any code changes.
        </intent_context>
        `
				: ""
		}
    `
}
```

---

## 3. Tool Definition Injection

### 3.1 Add select_active_intent Tool

**File**: `src/core/tools/SelectActiveIntentTool.ts` (NEW)

```typescript
import { BaseTool, ToolCallbacks } from "./BaseTool"
import { Task } from "../task/Task"
import { IntentManager } from "../../hooks/IntentManager"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult } = callbacks
		const { intent_id } = params

		// Load intent from active_intents.yaml
		const intentManager = IntentManager.getInstance()
		const intent = await intentManager.getIntent(intent_id)

		if (!intent) {
			pushToolResult({
				error: `Intent ${intent_id} not found in active_intents.yaml`,
			})
			return
		}

		// Store active intent in task
		task.activeIntentId = intent_id

		// Return context to LLM
		pushToolResult({
			success: true,
			intent: {
				id: intent.id,
				name: intent.name,
				owned_scope: intent.owned_scope,
				constraints: intent.constraints,
				acceptance_criteria: intent.acceptance_criteria,
			},
		})
	}
}
```

**Register Tool**:

```typescript
// In src/core/tools/index.ts
export const selectActiveIntentTool = new SelectActiveIntentTool()
```

---

## 4. Hook Engine Architecture

### 4.1 HookEngine Class

**File**: `src/hooks/HookEngine.ts` (NEW)

```typescript
import { Task } from "../core/task/Task"
import { ToolName } from "@roo-code/types"
import { PreToolHook } from "./PreToolHook"
import { PostToolHook } from "./PostToolHook"

export interface PreHookContext {
	toolName: ToolName
	params: any
	task: Task
	block: any
}

export interface PreHookResult {
	blocked: boolean
	reason?: string
	contextInjection?: string
}

export interface PostHookContext {
	toolName: ToolName
	params: any
	result: any
	task: Task
	block: any
}

export class HookEngine {
	private static instance: HookEngine
	private preHook: PreToolHook
	private postHook: PostToolHook

	private constructor() {
		this.preHook = new PreToolHook()
		this.postHook = new PostToolHook()
	}

	static getInstance(): HookEngine {
		if (!HookEngine.instance) {
			HookEngine.instance = new HookEngine()
		}
		return HookEngine.instance
	}

	async executePreHook(context: PreHookContext): Promise<PreHookResult> {
		return await this.preHook.execute(context)
	}

	async executePostHook(context: PostHookContext): Promise<void> {
		await this.postHook.execute(context)
	}
}
```

---

## 5. Pre-Hook Implementation

### 5.1 PreToolHook Class

**File**: `src/hooks/PreToolHook.ts` (NEW)

```typescript
import { PreHookContext, PreHookResult } from "./HookEngine"
import { IntentManager } from "./IntentManager"

export class PreToolHook {
	async execute(context: PreHookContext): Promise<PreHookResult> {
		const { toolName, params, task } = context

		// Only enforce for destructive operations
		const destructiveTools = ["write_to_file", "edit_file", "apply_patch", "search_replace", "execute_command"]

		if (!destructiveTools.includes(toolName)) {
			return { blocked: false }
		}

		// Check if intent is selected
		if (!task.activeIntentId) {
			return {
				blocked: true,
				reason: "You must call select_active_intent() before making changes",
			}
		}

		// Validate scope
		const intentManager = IntentManager.getInstance()
		const intent = await intentManager.getIntent(task.activeIntentId)

		if (!intent) {
			return {
				blocked: true,
				reason: `Active intent ${task.activeIntentId} not found`,
			}
		}

		// Check file scope for file operations
		if (params.path) {
			const isInScope = intent.owned_scope.some((pattern) => {
				// Simple glob matching (can be enhanced)
				return params.path.includes(pattern.replace("**", ""))
			})

			if (!isInScope) {
				return {
					blocked: true,
					reason: `File ${params.path} is outside intent scope: ${intent.owned_scope.join(", ")}`,
				}
			}
		}

		// Load related context
		const relatedTraces = await intentManager.getRelatedTraces(task.activeIntentId)
		const contextInjection =
			relatedTraces.length > 0
				? `\n<recent_changes>\n${relatedTraces
						.map((t) => `- ${t.file}: ${t.description}`)
						.join("\n")}\n</recent_changes>`
				: undefined

		return {
			blocked: false,
			contextInjection,
		}
	}
}
```

---

## 6. Post-Hook Implementation

### 6.1 PostToolHook Class

**File**: `src/hooks/PostToolHook.ts` (NEW)

```typescript
import { PostHookContext } from "./HookEngine"
import { TraceLogger } from "./TraceLogger"
import crypto from "crypto"

export class PostToolHook {
	private traceLogger: TraceLogger

	constructor() {
		this.traceLogger = new TraceLogger()
	}

	async execute(context: PostHookContext): Promise<void> {
		const { toolName, params, result, task } = context

		// Only log mutating operations
		const mutatingStools = ["write_to_file", "edit_file", "apply_patch", "search_replace"]

		if (!mutatingTools.includes(toolName)) {
			return
		}

		// Calculate content hash
		const contentHash = this.calculateContentHash(params.content || "")

		// Classify mutation type
		const mutationType = this.classifyMutation(toolName, params)

		// Write to agent_trace.jsonl
		await this.traceLogger.logTrace({
			id: crypto.randomUUID(),
			timestamp: new Date().toISOString(),
			intent_id: task.activeIntentId,
			tool: toolName,
			file: params.path,
			content_hash: contentHash,
			mutation_type: mutationType,
			vcs: {
				revision_id: await this.getGitHash(task.cwd),
			},
		})
	}

	private calculateContentHash(content: string): string {
		return crypto.createHash("sha256").update(content).digest("hex")
	}

	private classifyMutation(toolName: string, params: any): string {
		// Simple heuristic - can be enhanced with AST analysis
		if (toolName === "write_to_file" && params.content.includes("function")) {
			return "INTENT_EVOLUTION"
		}
		return "AST_REFACTOR"
	}

	private async getGitHash(cwd: string): Promise<string> {
		// Use simple-git to get current commit
		const git = require("simple-git")(cwd)
		try {
			const log = await git.log({ maxCount: 1 })
			return log.latest?.hash || "unknown"
		} catch {
			return "unknown"
		}
	}
}
```

---

## 7. Data Model Implementation

### 7.1 IntentManager Class

**File**: `src/hooks/IntentManager.ts` (NEW)

```typescript
import fs from "fs/promises"
import path from "path"
import yaml from "yaml"

export interface Intent {
	id: string
	name: string
	status: "IN_PROGRESS" | "COMPLETE" | "BLOCKED"
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
}

export class IntentManager {
	private static instance: IntentManager
	private intentsPath: string = ""

	static getInstance(): IntentManager {
		if (!IntentManager.instance) {
			IntentManager.instance = new IntentManager()
		}
		return IntentManager.instance
	}

	initialize(workspacePath: string) {
		this.intentsPath = path.join(workspacePath, ".orchestration", "active_intents.yaml")
	}

	async getIntent(intentId: string): Promise<Intent | null> {
		try {
			const content = await fs.readFile(this.intentsPath, "utf-8")
			const data = yaml.parse(content)
			return data.active_intents?.find((i: Intent) => i.id === intentId) || null
		} catch {
			return null
		}
	}

	async getAllIntents(): Promise<Intent[]> {
		try {
			const content = await fs.readFile(this.intentsPath, "utf-8")
			const data = yaml.parse(content)
			return data.active_intents || []
		} catch {
			return []
		}
	}

	async getRelatedTraces(intentId: string): Promise<any[]> {
		// Read agent_trace.jsonl and filter by intent_id
		const tracePath = path.join(path.dirname(this.intentsPath), "agent_trace.jsonl")

		try {
			const content = await fs.readFile(tracePath, "utf-8")
			const lines = content.split("\n").filter((l) => l.trim())
			return lines
				.map((line) => JSON.parse(line))
				.filter((trace) => trace.intent_id === intentId)
				.slice(-5) // Last 5 traces
		} catch {
			return []
		}
	}
}
```

---

## 8. Initialization Flow

### 8.1 Extension Activation

**File**: `src/extension.ts`

**Add to activate() function**:

```typescript
export async function activate(context: vscode.ExtensionContext) {
	// ... existing code ...

	// Initialize hook engine
	const hookEngine = HookEngine.getInstance()

	// Initialize intent manager for each workspace
	if (vscode.workspace.workspaceFolders) {
		for (const folder of vscode.workspace.workspaceFolders) {
			const orchestrationPath = path.join(folder.uri.fsPath, ".orchestration")

			// Create .orchestration directory if it doesn't exist
			await fs.mkdir(orchestrationPath, { recursive: true })

			// Initialize intent manager
			IntentManager.getInstance().initialize(folder.uri.fsPath)

			// Create default active_intents.yaml if it doesn't exist
			const intentsPath = path.join(orchestrationPath, "active_intents.yaml")
			try {
				await fs.access(intentsPath)
			} catch {
				await fs.writeFile(intentsPath, `active_intents: []\n`)
			}
		}
	}

	// ... rest of existing code ...
}
```

---

## 9. Summary of Changes

### Files to Modify:

1. ✅ `src/core/task/Task.ts` - Add hook calls in processToolUse()
2. ✅ `src/core/prompts/system.ts` - Inject intent context
3. ✅ `src/extension.ts` - Initialize hook engine

### Files to Create:

1. ✅ `src/hooks/HookEngine.ts` - Main orchestrator
2. ✅ `src/hooks/PreToolHook.ts` - Pre-execution logic
3. ✅ `src/hooks/PostToolHook.ts` - Post-execution logic
4. ✅ `src/hooks/IntentManager.ts` - Intent CRUD
5. ✅ `src/hooks/TraceLogger.ts` - Trace writer
6. ✅ `src/core/tools/SelectActiveIntentTool.ts` - New tool

### Directories to Create:

1. ✅ `src/hooks/` - Hook system code
2. ✅ `.orchestration/` - Runtime data (per workspace)

---

## 10. Testing Strategy

### Unit Tests:

- Test PreToolHook scope validation
- Test PostToolHook content hashing
- Test IntentManager YAML parsing

### Integration Tests:

- Test full flow: select_intent → write_file → trace logged
- Test scope violation blocking
- Test parallel session conflict detection

### Manual Testing:

- Create sample active_intents.yaml
- Run agent with intent enforcement
- Verify agent_trace.jsonl is populated
- Test rejection flow

---

**Status**: Design Complete ✅  
**Next**: Implementation Phase 1
