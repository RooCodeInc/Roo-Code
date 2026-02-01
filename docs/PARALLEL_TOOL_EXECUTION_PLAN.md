# خطة تنفيذ Parallel Tool Execution لنظام Roo Code

## المستند التعريفي

| العنصر            | التفاصيل            |
| ----------------- | ------------------- |
| **رقم الوثيقة**   | PTE-2024-001        |
| **الحالة**        | مسودة التخطيط       |
| **تاريخ الإنشاء** | 2024-01-15          |
| **المسؤول**       | فريق تطوير Roo Code |
| **الإصدار**       | 1.0.0               |

---

## 1. تحليل الأثر (Impact Analysis)

### 1.1 الملفات المتأثرة بالتغيير

#### 1.1.1 [`src/core/assistant-message/presentAssistantMessage.ts`](src/core/assistant-message/presentAssistantMessage.ts)

**الملخص:**
هذا الملف هو المعالج الأساسي لرسائل المساعد وتنفيذ الأدوات. حاليًا يعمل بشكل تسلسلي (sequential) حيث ينتظر تنفيذ كل أداة قبل الانتقال للأداة التالية.

**الدوال المتأثرة:**

| الدالة                          | السطر | نوع التأثير | الوصف                                                |
| ------------------------------- | ----- | ----------- | ---------------------------------------------------- |
| `presentAssistantMessage()`     | 62    | تغيير جذري  | ستتحول من التنفيذ التسلسلي إلى التنفيذ المتوازي      |
| `checkpointSaveAndMark()`       | 1023  | تعديل       | يجب تعديلها لدعم الـ checkpoints للأدوات المتوازية   |
| `pushToolResultToUserContent()` | 379   | تعديل       | دالة مساعدة يجب تعديلها لضمان الترتيب الصحيح للنتائج |

**المتغيرات المتأثرة:**

| المتغير                                    | السطر   | نوع التغيير | الوصف                                 |
| ------------------------------------------ | ------- | ----------- | ------------------------------------- |
| `presentAssistantMessageLocked`            | 72, 353 | تعديل       | يجب إضافة قفل منفصل لكل أداة          |
| `presentAssistantMessageHasPendingUpdates` | 73, 354 | تعديل       | قد لا تكون ضرورية مع التنفيذ المتوازي |
| `assistantMessageContent`                  | 352     | تعديل       | يجب تتبع حالة كل أداة بشكل منفصل      |
| `userMessageContent`                       | 355     | تعديل       | يجب الحفاظ على ترتيب النتائج          |

**نقاط الفشل المحتملة:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FAILURE POINTS ANALYSIS                        │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Race Conditions (سباق البيانات)                                 │
│    - الأدوات المتوازية تكتب لنفس المتغيرات                         │
│    - الترتيب غير مضمون لـ userMessageContent                       │
│    -checkpointSaveAndMark قد تُستدعي مرات متزامنة                   │
├─────────────────────────────────────────────────────────────────────┤
│ 2. State Inconsistency (عدم اتساق الحالة)                          │
│    - presentAssistantMessageLocked يتشارك بين جميع الأدوات         │
│    - currentStreamingContentIndex قد يصبح غير دقيق                  │
├─────────────────────────────────────────────────────────────────────┤
│ 3. Error Propagation (نشر الأخطاء)                                 │
│    - خطأ في أداة قد يؤثر على أداة أخرى                             │
│    - قد يتم فقدان نتائج أدوات بسبب خطأ سابق                        │
├─────────────────────────────────────────────────────────────────────┤
│ 4. Checkpoint Integrity (سلامة نقاط الاستعادة)                     │
│    - الأدوات المتوازية تعدل ملفات متعددة                          │
│    - قد يتم إنشاء checkpoint في حالة غير مكتملة                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### 1.1.2 [`src/core/task/Task.ts`](src/core/task/Task.ts)

**الملخص:**
هذا هو الملف الرئيسي لإدارة المهام ويتعامل مع الـ streaming و history و checkpoints.

**الدوال المتأثرة:**

| الدالة                               | السطر | نوع التأثير | الوصف                                |
| ------------------------------------ | ----- | ----------- | ------------------------------------ |
| `recursivelyMakeClineRequests()`     | 2621  | تغيير جذري  | يجب تعديلها لدعم أدوات متوازية       |
| `handleToolCallEvent()`              | 401   | تعديل       | يجب تعديلها لتتبع أحداث أدوات متعددة |
| `flushPendingToolResultsToHistory()` | 1195  | تعديل       | يجب تعديلها لضمان ترتيب النتائج      |
| `addToApiConversationHistory()`      | 1014  | تعديل       | قد تحتاج لتعديل طفيف                 |
| `saveApiConversationHistory()`       | 1251  | تعديل       | لا تغيير مباشر لكن قد تتأثر          |

**المتغيرات المتأثرة:**

| المتغير                          | السطر | نوع التغيير | الوصف                                 |
| -------------------------------- | ----- | ----------- | ------------------------------------- |
| `streamingToolCallIndices`       | 523   | تعديل       | يجب تتبع أدوات متعددة متدفقة          |
| `assistantMessageSavedToHistory` | 370   | تعديل       | Flag جديد مضاف - يتحكم في حفظ الرسالة |
| `assistantMessageContent`        | 352   | تعديل       | يجب تتبع حالة كل أداة                 |
| `userMessageContent`             | 355   | تعديل       | يجب الحفاظ على ترتيب النتائج          |
| `didRejectTool`                  | 514   | تعديل       | يجب أن يكون خاص بكل أداة              |
| `didAlreadyUseTool`              | 515   | تعديل       | يجب أن يكون خاص بكل أداة              |

**نقاط الفشل المحتملة:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FAILURE POINTS ANALYSIS                        │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Message History Corruption (تلف سجل الرسائل)                    │
│    - أدوات متوازية تضيف نتائج في نفس الوقت                         │
│    - الترتيب قد يكون غير صحيح في الـ API history                    │
├─────────────────────────────────────────────────────────────────────┤
│ 2. Stream State Confusion (تشوش حالة الـ streaming)                 │
│    - أدوات متعددة تبدأ وتنتهي في أوقات مختلفة                      │
│    - currentStreamingContentIndex لا يعكس الحالة الحقيقية           │
├─────────────────────────────────────────────────────────────────────┤
│ 3. Delegation Issues (مشاكل التفويض)                               │
│    - new_task مع أدوات متوازية قد يسبب مشاكل                        │
│    - الـ parent task قد يُنتظر بشكل خاطئ                           │
├─────────────────────────────────────────────────────────────────────┤
│ 4. Abort/Cancellation Problems (مشاكل الإلغاء)                     │
│    - إلغاء أداة واحدة قد يؤثر على الأخرى                          │
│    - cleanup قد يكون غير كامل                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### 1.1.3 [`src/core/task/build-tools.ts`](src/core/task/build-tools.ts)

**الملخص:**
هذا الملف مسؤول عن بناء قائمة الأدوات المرسلة للـ API.

**الدوال المتأثرة:**

| الدالة                                    | السطر | نوع التأثير | الوصف                             |
| ----------------------------------------- | ----- | ----------- | --------------------------------- |
| `buildNativeToolsArrayWithRestrictions()` | 82    | تعديل طفيف  | قد تحتاج لإضافة metadata للأولوية |

**المتغيرات المتأثرة:**

- لا توجد متغيرات state متأثرة بشكل مباشر
- قد تحتاج لإضافة معلومات حول أولوية الأدوات

**نقاط الفشل المحتملة:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FAILURE POINTS ANALYSIS                        │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Missing Priority Information (فقدان معلومات الأولوية)           │
│    - API يحتاج يعرف أي أدوات يمكن تنفيذها متوازي                   │
│    - currently no mechanism to specify parallelization rules        │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### 1.1.4 [`src/core/prompts/tools/native-tools/converters.ts`](src/core/prompts/tools/native-tools/converters.ts)

**الملخص:**
هذا الملف يحول صيغ الأدوات بين OpenAI و Anthropic.

**الدوال المتأثرة:**

| الدالة                                 | السطر | نوع التأثير | الوصف                                |
| -------------------------------------- | ----- | ----------- | ------------------------------------ |
| `convertOpenAIToolChoiceToAnthropic()` | 73    | تعديل       | يجب إضافة دعم لـ parallel tool calls |

**نقاط الفشل المحتملة:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FAILURE POINTS ANALYSIS                        │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Missing Parallel Config (فقدان تكوين التوازي)                   │
│    - parallelToolCalls parameter قد لا يُمرر بشكل صحيح              │
│    - Anthropic API قد لا يدعم بعض أشكال التوازي                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### 1.1.5 [`src/services/checkpoints/RepoPerTaskCheckpointService.ts`](src/services/checkpoints/RepoPerTaskCheckpointService.ts)

**الملخص:**
خدمة الـ checkpointing للـ repository.

**الدوال المتأثرة:**

| الدالة                | نوع التأثير | الوصف                          |
| --------------------- | ----------- | ------------------------------ |
| `saveCheckpoint()`    | تعديل       | يجب تعديلها لدعم أدوات متوازية |
| `restoreCheckpoint()` | لا تغيير    | لا تتأثر بشكل مباشر            |

**نقاط الفشل المحتملة:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FAILURE POINTS ANALYSIS                        │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Partial State Checkpoints (نقاط استعادة جزئية)                 │
│    - checkpoint قد يُؤخذ بينما أداة لم تنتهِ                       │
│    - الملفات قد تكون في حالة غير مكتملة                           │
├─────────────────────────────────────────────────────────────────────┤
│ 2. Concurrent Git Operations (عمليات git متزامنة)                 │
│    - أدوات متوازية تعدل نفس الملفات                                │
│    - git operations قد تتعارض                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 1.2 ملخص الأثر على مستوى المشروع

```
┌─────────────────────────────────────────────────────────────────────┐
│                      IMPACT SUMMARY                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│   │   HIGH       │    │   MEDIUM     │    │    LOW       │          │
│   │  IMPACT      │    │   IMPACT     │    │   IMPACT     │          │
│   ├──────────────┤    ├──────────────┤    ├──────────────┤          │
│   │ 1. Task.ts   │    │ 2. present   │    │ 4. converters│          │
│   │              │    │   Assistant  │    │    .ts       │          │
│   │              │    │    Message   │    │              │          │
│   │              │    │    .ts       │    │              │          │
│   │              │    │              │    │              │          │
│   │              │    │ 3. build-    │    │              │          │
│   │              │    │    tools.ts  │    │              │          │
│   │              │    │              │    │              │          │
│   │              │    │ 5. checkpoint│    │              │          │
│   │              │    │    service   │    │              │          │
│   └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                                      │
│   Total Lines to Modify: ~1,500 lines                               │
│   Total New Files: 3 files                                          │
│   Estimated Effort: 2-3 weeks                                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. التصميم المعماري الجديد

### 2.1 نظرة عامة على النظام

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PARALLEL TOOL EXECUTION ARCHITECTURE             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    API Response (Multi-tool)                 │   │
│   │         tool_use_1, tool_use_2, tool_use_3, ...             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │              Tool Dependency Graph Builder                   │   │
│   │   ┌─────────────────────────────────────────────────────┐   │   │
│   │   │  Analyze dependencies between tools                 │   │   │
│   │   │  Build execution groups (independent vs dependent)  │   │   │
│   │   │  Calculate execution order within groups            │   │   │
│   │   └─────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    Parallel Executor                        │   │
│   │   ┌─────────────────────────────────────────────────────┐   │   │
│   │   │  Semaphore-based concurrent execution               │   │   │
│   │   │  ┌─────────────────────────────────────────────┐   │   │   │
│   │   │  │  Group 1: Independent tools (parallel)       │   │   │   │
│   │   │  │  ┌─────┐ ┌─────┐ ┌─────┐                      │   │   │   │
│   │   │  │  │ TOOL │ │ TOOL │ │ TOOL │                      │   │   │   │
│   │   │  │  │  1   │ │  2   │ │  3   │                      │   │   │   │
│   │   │  │  └─────┘ └─────┘ └─────┘                      │   │   │   │
│   │   │  └─────────────────────────────────────────────┘   │   │   │
│   │   │  ┌─────────────────────────────────────────────┐   │   │   │
│   │   │  │  Group 2: Dependent on Group 1 results      │   │   │   │
│   │   │  │  ┌─────┐ ┌─────┐                              │   │   │   │
│   │   │  │  │ TOOL │ │ TOOL │                              │   │   │   │
│   │   │  │  │  4   │ │  5   │                              │   │   │   │
│   │   │  │  └─────┘ └─────┘                              │   │   │   │
│   │   │  └─────────────────────────────────────────────┘   │   │   │
│   │   └─────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │              Result Aggregator & Order Preserver            │   │
│   │   - Collect results in order of tool_use_id                │   │
│   │   - Handle errors gracefully                               │   │
│   │   - Maintain checkpoint integrity                          │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    userMessageContent                        │   │
│   │         (preserving order and dependencies)                 │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Tool Dependency Graph Builder

#### 2.2.1 ملف جديد: [`src/core/tools/dependency-graph/ToolDependencyGraphBuilder.ts`](src/core/tools/dependency-graph/ToolDependencyGraphBuilder.ts)

```typescript
/**
 * ToolDependencyGraphBuilder
 *
 * Builds a dependency graph for tool execution to determine
 * which tools can run in parallel and which must be sequential.
 *
 * ## Dependency Rules:
 *
 * 1. File-based dependencies:
 *    - write_to_file → read_file (same file)
 *    - edit_file → read_file (same file)
 *    - apply_diff → read_file (same file)
 *
 * 2. Tool-specific dependencies:
 *    - new_task: must be last (triggers delegation)
 *    - attempt_completion: must be last
 *    - checkpoint_save: must be after write operations
 *
 * 3. Global locks:
 *    - browser_action: only one at a time
 *    - execute_command: only one at a time (per terminal)
 *    - update_todo_list: only one at a time
 */

export interface ToolNode {
	id: string
	toolUseId: string
	toolName: string
	params: Record<string, any>
	dependencies: Set<string> // IDs of tools this tool depends on
	dependents: Set<string> // IDs of tools that depend on this tool
	canRunInParallel: boolean
	priority: number
	isExclusive: boolean // Tools that can't run with others
}

export interface DependencyGraph {
	nodes: Map<string, ToolNode>
	executionGroups: ToolNode[][] // Groups that can run in parallel
	totalTools: number
	hasExclusiveTools: boolean
	requiresSequentialExecution: boolean
}

export interface BuildGraphOptions {
	mode: string
	customModes: ModeConfig[]
	experiments: Record<string, boolean>
}

export class ToolDependencyGraphBuilder {
	private nodes: Map<string, ToolNode> = new Map()

	/**
	 * Build dependency graph from tool use blocks
	 */
	build(
		toolUses: Array<{ id: string; name: string; params: Record<string, any> }>,
		options: BuildGraphOptions,
	): DependencyGraph {
		// Clear previous state
		this.nodes.clear()

		// Step 1: Create nodes for all tools
		this.createNodes(toolUses, options)

		// Step 2: Analyze and add dependencies
		this.analyzeDependencies()

		// Step 3: Build execution groups
		const executionGroups = this.buildExecutionGroups()

		// Step 4: Check for exclusive tools
		const hasExclusiveTools = this.checkForExclusiveTools()

		return {
			nodes: this.nodes,
			executionGroups,
			totalTools: this.nodes.size,
			hasExclusiveTools,
			requiresSequentialExecution: hasExclusiveTools,
		}
	}

	private createNodes(
		toolUses: Array<{ id: string; name: string; params: Record<string, any> }>,
		options: BuildGraphOptions,
	): void {
		for (const [index, tool] of toolUses.entries()) {
			const node: ToolNode = {
				id: tool.id,
				toolUseId: tool.id,
				toolName: tool.name,
				params: tool.params,
				dependencies: new Set(),
				dependents: new Set(),
				canRunInParallel: this.canRunInParallel(tool.name, options),
				priority: index, // Maintain original order for dependent tools
				isExclusive: this.isExclusiveTool(tool.name),
			}
			this.nodes.set(tool.id, node)
		}
	}

	private analyzeDependencies(): void {
		const nodesArray = Array.from(this.nodes.values())

		for (const node of nodesArray) {
			const otherNodes = nodesArray.filter((n) => n.id !== node.id)

			for (const otherNode of otherNodes) {
				if (this.dependsOn(node, otherNode)) {
					node.dependencies.add(otherNode.id)
					otherNode.dependents.add(node.id)
				}
			}
		}
	}

	private dependsOn(source: ToolNode, target: ToolNode): boolean {
		// new_task and attempt_completion must be last
		if (["new_task", "attempt_completion"].includes(source.toolName)) {
			return target.toolUseId < source.toolUseId // All tools with lower index
		}

		// File-based dependencies
		if (this.isFileWritingTool(source.toolName)) {
			if (this.isFileReadingTool(target.toolName)) {
				const sourceFile = this.getFilePath(source)
				const targetFile = this.getFilePath(target)
				if (sourceFile && targetFile && sourceFile === targetFile) {
					return true
				}
			}
		}

		// Checkpoint dependencies
		if (source.toolName === "checkpoint_save") {
			return target.toolUseId < source.toolUseId
		}

		return false
	}

	private buildExecutionGroups(): ToolNode[][] {
		const groups: ToolNode[][] = []
		const visited = new Set<string>()
		const inCurrentGroup = new Set<string>()

		// Find nodes with no dependencies (can start immediately)
		const startNodes = Array.from(this.nodes.values()).filter((node) => node.dependencies.size === 0)

		for (const node of startNodes) {
			if (visited.has(node.id)) continue

			const group = this.collectIndependentNodes(node, visited)
			groups.push(group)
		}

		return groups
	}

	private collectIndependentNodes(startNode: ToolNode, visited: Set<string>): ToolNode[] {
		const group: ToolNode[] = []
		const queue: ToolNode[] = [startNode]

		while (queue.length > 0) {
			const node = queue.shift()!
			if (visited.has(node.id)) continue
			if (node.isExclusive && group.length > 0) continue // Exclusive tools must be alone

			visited.add(node.id)
			group.push(node)

			// Add dependents that have all their dependencies satisfied
			for (const dependent of node.dependents) {
				const dependentNode = this.nodes.get(dependent)
				if (dependentNode && !visited.has(dependent)) {
					const allDependenciesSatisfied = Array.from(dependentNode.dependencies).every((depId) =>
						visited.has(depId),
					)
					if (allDependenciesSatisfied) {
						queue.push(dependentNode)
					}
				}
			}
		}

		return group
	}

	private canRunInParallel(toolName: string, options: BuildGraphOptions): boolean {
		// Exclusive tools
		if (this.isExclusiveTool(toolName)) {
			return false
		}

		// Browser actions can run in parallel with non-browser tools
		if (toolName === "browser_action") {
			return true
		}

		return true // Default: can run in parallel
	}

	private isExclusiveTool(toolName: string): boolean {
		const exclusiveTools = [
			"new_task",
			"attempt_completion",
			"browser_action", // Only one browser action at a time
			"execute_command", // Terminal-based
			"update_todo_list",
			"switch_mode",
			"run_slash_command",
			"skill",
			"generate_image", // Long-running, potentially conflicting
		]
		return exclusiveTools.includes(toolName)
	}

	private isFileWritingTool(toolName: string): boolean {
		return ["write_to_file", "apply_diff", "edit_file", "apply_patch"].includes(toolName)
	}

	private isFileReadingTool(toolName: string): boolean {
		return ["read_file", "list_files", "search_files", "codebase_search"].includes(toolName)
	}

	private getFilePath(node: ToolNode): string | null {
		const pathParams = ["path", "file_path", "filepath"]
		for (const param of pathParams) {
			if (node.params[param]) {
				return node.params[param]
			}
		}
		return null
	}

	private checkForExclusiveTools(): boolean {
		return Array.from(this.nodes.values()).some((node) => node.isExclusive)
	}
}
```

---

### 2.3 Parallel Executor مع Semaphore

#### 2.3.1 ملف جديد: [`src/core/tools/executor/ParallelToolExecutor.ts`](src/core/tools/executor/ParallelToolExecutor.ts)

```typescript
import { ToolDependencyGraphBuilder, type DependencyGraph } from "../dependency-graph/ToolDependencyGraphBuilder"
import type { ToolUse, ToolResult, ClineAsk, ClineAskResponse } from "../../../shared/tools"
import type { Task } from "../../task/Task"

/**
 * Semaphore for controlling concurrent tool execution
 */
class Semaphore {
	private permits: number
	private waiters: Array<{ resolve: () => void }> = []

	constructor(permits: number) {
		this.permits = permits
	}

	async acquire(): Promise<void> {
		if (this.permits > 0) {
			this.permits--
			return Promise.resolve()
		}

		return new Promise((resolve) => {
			this.waiters.push({ resolve })
		})
	}

	release(): void {
		this.permits++
		if (this.waiters.length > 0) {
			const waiter = this.waiters.shift()!
			this.permits--
			waiter.resolve()
		}
	}
}

/**
 * Result of a single tool execution
 */
export interface ToolExecutionResult {
	toolUseId: string
	toolName: string
	success: boolean
	result?: ToolResult
	error?: Error
	duration: number
	checkpointSaved: boolean
}

/**
 * Parallel tool execution result
 */
export interface ParallelExecutionResult {
	results: ToolExecutionResult[]
	totalDuration: number
	allSuccessful: boolean
	hasFailures: boolean
}

/**
 * Configuration for parallel execution
 */
export interface ParallelExecutorConfig {
	maxConcurrentTools: number // Default: 3
	timeoutPerTool: number // Default: 60000ms
	checkpointBeforeWriteTools: boolean // Default: true
	preserveResultOrder: boolean // Default: true
	continueOnError: boolean // Default: false
}

export class ParallelToolExecutor {
	private task: Task
	private graphBuilder: ToolDependencyGraphBuilder
	private semaphore: Semaphore
	private config: ParallelExecutorConfig
	private abortController: AbortController

	constructor(task: Task, config?: Partial<ParallelExecutorConfig>) {
		this.task = task
		this.graphBuilder = new ToolDependencyGraphBuilder()
		this.config = {
			maxConcurrentTools: 3,
			timeoutPerTool: 60000,
			checkpointBeforeWriteTools: true,
			preserveResultOrder: true,
			continueOnError: false,
			...config,
		}
		this.semaphore = new Semaphore(this.config.maxConcurrentTools)
		this.abortController = new AbortController()
	}

	/**
	 * Execute multiple tools in parallel according to their dependencies
	 */
	async execute(
		toolUses: Array<ToolUse>,
		mode: string,
		customModes: any[],
		experiments: Record<string, boolean>,
	): Promise<ParallelExecutionResult> {
		const startTime = Date.now()
		const results: Map<string, ToolExecutionResult> = new Map()

		// Build dependency graph
		const graph = this.graphBuilder.build(toolUses, { mode, customModes, experiments })

		// If sequential execution is required, fall back to old behavior
		if (graph.requiresSequentialExecution) {
			return this.executeSequentially(toolUses, results, startTime)
		}

		// Execute groups in order
		for (const group of graph.executionGroups) {
			if (this.abortController.signal.aborted) {
				break
			}

			const groupPromises = group.map((node) => this.executeWithSemaphore(node, results, startTime))

			await Promise.all(groupPromises)
		}

		// Return results in order
		return {
			results: toolUses.map((tool) => results.get(tool.id)!),
			totalDuration: Date.now() - startTime,
			allSuccessful: Array.from(results.values()).every((r) => r.success),
			hasFailures: Array.from(results.values()).some((r) => !r.success),
		}
	}

	private async executeWithSemaphore(
		node: any,
		results: Map<string, ToolExecutionResult>,
		startTime: number,
	): Promise<void> {
		await this.semaphore.acquire()

		try {
			const result = await this.executeSingleTool(node)
			results.set(node.id, result)
		} finally {
			this.semaphore.release()
		}
	}

	private async executeSingleTool(node: any): Promise<ToolExecutionResult> {
		const toolUse = node.toolUse
		const startTime = Date.now()
		let checkpointSaved = false

		try {
			// Save checkpoint before write operations
			if (this.config.checkpointBeforeWriteTools && this.isWriteTool(toolUse.name)) {
				await this.saveCheckpoint()
				checkpointSaved = true
			}

			// Execute tool
			const result = await this.executeTool(toolUse)

			return {
				toolUseId: toolUse.id,
				toolName: toolUse.name,
				success: true,
				result,
				duration: Date.now() - startTime,
				checkpointSaved,
			}
		} catch (error) {
			return {
				toolUseId: toolUse.id,
				toolName: toolUse.name,
				success: false,
				error: error as Error,
				duration: Date.now() - startTime,
				checkpointSaved,
			}
		}
	}

	private async executeTool(toolUse: ToolUse): Promise<ToolResult> {
		// Implementation delegates to existing tool handlers
		// but wrapped with proper callbacks and error handling
		return {} as ToolResult // Placeholder
	}

	private isWriteTool(toolName: string): boolean {
		return ["write_to_file", "apply_diff", "edit_file", "apply_patch", "generate_image"].includes(toolName)
	}

	private async saveCheckpoint(): Promise<void> {
		// Implementation using existing checkpoint service
	}

	private async executeSequentially(
		toolUses: Array<ToolUse>,
		results: Map<string, ToolExecutionResult>,
		startTime: number,
	): Promise<ParallelExecutionResult> {
		// Fallback to sequential execution
		for (const toolUse of toolUses) {
			const result = await this.executeSingleTool({ toolUse })
			results.set(toolUse.id, result)

			// Stop on first error if not continueOnError
			if (!this.config.continueOnError && !result.success) {
				break
			}
		}

		return {
			results: toolUses.map((tool) => results.get(tool.id)!),
			totalDuration: Date.now() - startTime,
			allSuccessful: Array.from(results.values()).every((r) => r.success),
			hasFailures: Array.from(results.values()).some((r) => !r.success),
		}
	}

	/**
	 * Abort all running tool executions
	 */
	abort(): void {
		this.abortController.abort()
	}
}
```

---

### 2.4 Dependency Resolver

#### 2.4.1 ملف جديد: [`src/core/tools/dependency-graph/ToolDependencyResolver.ts`](src/core/tools/dependency-graph/ToolDependencyResolver.ts)

```typescript
/**
 * ToolDependencyResolver
 *
 * Resolves tool dependencies and provides execution hints.
 * This is used by the executor to determine execution order.
 */

export interface ExecutionHint {
	canExecuteNow: boolean
	waitingFor: string[] // IDs of tools we're waiting for
	blockedBy: string[] // IDs of tools blocking us
	executionOrder: number
	parallelGroup: number
}

export class ToolDependencyResolver {
	/**
	 * Get execution hints for a specific tool
	 */
	getExecutionHint(toolId: string, completedTools: Set<string>, graph: DependencyGraph): ExecutionHint {
		const node = graph.nodes.get(toolId)
		if (!node) {
			return {
				canExecuteNow: false,
				waitingFor: [],
				blockedBy: [],
				executionOrder: -1,
				parallelGroup: -1,
			}
		}

		const waitingFor = Array.from(node.dependencies).filter((depId) => !completedTools.has(depId))
		const blockedBy = waitingFor // Simplified

		return {
			canExecuteNow: waitingFor.length === 0,
			waitingFor,
			blockedBy,
			executionOrder: node.priority,
			parallelGroup: this.getParallelGroup(node, graph),
		}
	}

	private getParallelGroup(node: any, graph: DependencyGraph): number {
		for (let i = 0; i < graph.executionGroups.length; i++) {
			if (graph.executionGroups[i].some((n) => n.id === node.id)) {
				return i
			}
		}
		return -1
	}

	/**
	 * Check if all dependencies are satisfied
	 */
	areDependenciesSatisfied(toolId: string, completedTools: Set<string>, graph: DependencyGraph): boolean {
		const node = graph.nodes.get(toolId)
		if (!node) return false

		return Array.from(node.dependencies).every((depId) => completedTools.has(depId))
	}

	/**
	 * Get tools that are ready to execute
	 */
	getReadyTools(graph: DependencyGraph, completedTools: Set<string>): string[] {
		return Array.from(graph.nodes.values())
			.filter(
				(node) => !completedTools.has(node.id) && this.areDependenciesSatisfied(node.id, completedTools, graph),
			)
			.map((node) => node.id)
	}
}
```

---

### 2.5 Error Handling Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING STRATEGY                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐ │
│   │   Tool Error     │    │  Group Error     │    │  Fatal Error  │ │
│   │                  │    │                  │    │               │ │
│   │  - Log error     │    │  - Stop group    │    │  - Abort all  │ │
│   │  - Continue to   │    │  - Error in      │    │  - Rollback   │ │
│   │    next tool     │    │    dependent     │    │  - Notify UI  │ │
│   │  - Record result │    │    tools         │    │  - Checkpoint │ │
│   │  - UI shows error│    │  - Notify UI     │    │    at safe    │ │
│   │                  │    │  - Continue with │    │    point      │ │
│   │                  │    │    other groups  │    │               │ │
│   └──────────────────┘    └──────────────────┘    └───────────────┘ │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │                    ERROR FLOW DIAGRAM                        │  │
│   │                                                              │  │
│   │   Tool Starts ──► Execution ──► Success?                     │  │
│   │                          │                                  │  │
│   │                          ▼ No                               │  │
│   │                    Record Error ──► Update UI               │  │
│   │                          │                                  │  │
│   │                          ▼                                  │  │
│   │               ContinueOnError? ──► Yes ──► Next Tool        │  │
│   │                          │                                  │  │
│   │                          ▼ No                               │  │
│   │              Notify Dependent Tools ──► Abort Group         │  │
│   │                          │                                  │  │
│   │                          ▼                                  │  │
│   │               All Tools Done? ──► No ──► Continue Groups    │  │
│   │                          │                                  │  │
│   │                          ▼ Yes                              │  │
│   │               Generate Combined Result                       │  │
│   │                                                              │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. التنفيذ الآمن (Safe Implementation)

### 3.1 Step-by-step Changes مع Rollback Points

#### المرحلة 1: إنشاء البنية التحتية (Week 1)

**الخطوة 1.1: إنشاء ToolDependencyGraphBuilder**

```
Files Created:
├── src/core/tools/dependency-graph/
│   ├── index.ts (10 lines)
│   ├── ToolDependencyGraphBuilder.ts (300 lines)
│   └── ToolDependencyResolver.ts (150 lines)

Rollback: Delete the directory
```

**الخطوة 1.2: إنشاء ParallelToolExecutor**

```
Files Created:
├── src/core/tools/executor/
│   ├── index.ts (10 lines)
│   ├── ParallelToolExecutor.ts (400 lines)

Rollback: Delete the directory
```

**Acceptance Criteria:**

- [ ] Unit tests pass for dependency graph building
- [ ] Unit tests pass for semaphore
- [ ] Edge cases tested (circular dependencies, etc.)

---

#### المرحلة 2: تعديل Task.ts (Week 1-2)

**الخطوة 2.1: إضافة متغيرات الحالة الجديدة**

```typescript
// In Task.ts, add new state variables:

// Track per-tool execution state
private executingToolIds: Set<string> = new Set();
private completedToolIds: Set<string> = new Set();
private toolExecutionStartTimes: Map<string, number> = new Map();

// Per-tool rejection tracking (replaces global didRejectTool)
private toolRejections: Map<string, boolean> = new Map();

// Parallel execution configuration
private parallelExecutor?: ParallelToolExecutor;

// Dependency graph for current turn
private currentDependencyGraph?: DependencyGraph;
```

**Rollback Point:**

```git
# Git commit before changes
git commit -m "feat: add parallel execution state variables"
```

**Acceptance Criteria:**

- [ ] No breaking changes to existing functionality
- [ ] New state variables don't affect sequential execution
- [ ] Memory usage within acceptable limits

---

**الخطوة 2.2: تعديل handleToolCallEvent**

```typescript
// Modify to handle multiple concurrent tool events
private handleToolCallEvent(event: ToolCallEvent): void {
  // Track each tool's streaming state separately
  const toolId = event.id;

  if (event.type === "tool_call_start") {
    this.executingToolIds.add(toolId);
    this.toolExecutionStartTimes.set(toolId, Date.now());
    NativeToolCallParser.startStreamingToolCall(toolId, event.name);
  }

  // ... rest of implementation
}
```

**Rollback Point:**

```git
# Git commit before changes
git commit -m "feat: modify handleToolCallEvent for concurrent tools"
```

**Acceptance Criteria:**

- [ ] Existing sequential tool calls still work
- [ ] Tool call IDs are tracked per tool
- [ ] No memory leaks in tracking

---

**الخطوة 2.3: تعديل recursivelyMakeClineRequests**

```typescript
// Add parallel execution path
private async executeToolsParallel(
  assistantContent: Array<ToolUse | McpToolUse>,
): Promise<void> {
  // Build dependency graph
  const graph = this.graphBuilder.build(
    assistantContent,
    { mode: await this.getTaskMode(), /* ... */ }
  );

  // Execute with parallel executor
  this.parallelExecutor = new ParallelToolExecutor(this, {
    maxConcurrentTools: this.config?.maxParallelTools ?? 3,
  });

  const result = await this.parallelExecutor.execute(
    assistantContent,
    await this.getTaskMode(),
    /* ... */
  );

  // Collect results
  for (const toolResult of result.results) {
    if (toolResult.success) {
      this.pushToolResultToUserContent(toolResult.result!);
    } else {
      this.handleToolError(toolResult);
    }
  }
}
```

**Rollback Point:**

```git
# Git commit before changes
git commit -m "feat: add parallel tool execution path"
```

**Acceptance Criteria:**

- [ ] Parallel execution works for independent tools
- [ ] Results are collected in correct order
- [ ] Dependencies are respected

---

#### المرحلة 3: تعديل presentAssistantMessage.ts (Week 2)

**الخطوة 3.1: إعادة هيكلة التنفيذ**

```typescript
// Transform from sequential to parallel execution
export async function presentAssistantMessage(cline: Task) {
	// ... existing code ...

	// Check if we have multiple tools that can run in parallel
	const pendingTools = cline.getPendingTools()
	const canRunParallel = pendingTools.length > 1 && cline.shouldUseParallelExecution()

	if (canRunParallel) {
		// Execute in parallel
		await cline.executeToolsParallel(pendingTools)
	} else {
		// Fall back to sequential (existing behavior)
		await cline.executeToolsSequentially(pendingTools)
	}
}
```

**Rollback Point:**

```git
# Git commit before changes
git commit -m "feat: refactor presentAssistantMessage for parallel execution"
```

**Acceptance Criteria:**

- [ ] Backward compatibility maintained (sequential still works)
- [ ] Parallel mode can be toggled
- [ ] UI shows parallel execution state

---

#### المرحلة 4: تعديل Checkpoint Service (Week 2)

**الخطوة 4.1: دعم الـ checkpoints للأدوات المتوازية**

```typescript
// In RepoPerTaskCheckpointService.ts

/**
 * Save checkpoint with tool context
 */
async saveCheckpointWithContext(
  message: string,
  options: CheckpointOptions,
  toolContext?: {
    executingTools: string[];
    completedTools: string[];
    pendingTools: string[];
  },
): Promise<void> {
  // Ensure no write tools are in progress
  await this.waitForWriteToolsCompletion();

  // Save checkpoint with context
  await this.saveCheckpoint(message, options);

  // Record tool context for recovery
  if (toolContext) {
    await this.recordToolContext(toolContext);
  }
}

private async waitForWriteToolsCompletion(): Promise<void> {
  // Wait for all write operations to complete
  // This prevents partial state checkpoints
}
```

**Rollback Point:**

```git
# Git commit before changes
git commit -m "feat: add parallel tool checkpoint support"
```

**Acceptance Criteria:**

- [ ] Checkpoints only saved when no write tools running
- [ ] Tool context saved for recovery
- [ ] Restore works after parallel execution

---

### 3.2 Feature Flags و Gradual Rollout

```typescript
// Configuration for feature flags
export interface ParallelExecutionConfig {
	enabled: boolean // Master switch

	// Execution limits
	maxConcurrentTools: number // Default: 3
	maxDependentTools: number // Default: 5

	// Feature subsets
	allowIndependentParallel: boolean // Default: true
	allowBrowserParallel: boolean // Default: false
	allowCommandParallel: boolean // Default: false

	// Safety
	checkpointBeforeWrite: boolean // Default: true
	continueOnError: boolean // Default: false

	// Limits
	maxToolsPerTurn: number // Default: 10
	timeoutPerTool: number // Default: 60000
}

// Feature flag configuration in package.json or settings
const PARALLEL_EXECUTION_FLAGS: ParallelExecutionConfig = {
	enabled: false, // Disabled by default
	maxConcurrentTools: 3,
	maxDependentTools: 5,
	allowIndependentParallel: true,
	allowBrowserParallel: false,
	allowCommandParallel: false,
	checkpointBeforeWrite: true,
	continueOnError: false,
	maxToolsPerTurn: 10,
	timeoutPerTool: 60000,
}

// Gradual rollout phases
const ROLLOUT_PHASES = [
	{ percentage: 0, flags: { enabled: false } }, // Development
	{ percentage: 5, flags: { enabled: true, maxConcurrentTools: 2 } }, // 5% users
	{ percentage: 25, flags: { enabled: true, maxConcurrentTools: 3 } }, // 25% users
	{ percentage: 50, flags: { enabled: true, maxConcurrentTools: 4 } }, // 50% users
	{ percentage: 100, flags: { enabled: true, maxConcurrentTools: 5 } }, // All users
]
```

---

### 3.3 Rollback Plan الشامل

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ROLLBACK PLAN                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ROLLBACK LEVEL 1: Immediate (Hours)                               │
│   ─────────────────────────────────                                 │
│   • Disable via feature flag: `roo.parallelExecution.enabled=false` │
│   • Falls back to sequential execution automatically                 │
│   • No code changes required                                         │
│   • User sees no difference                                          │
│                                                                      │
│   ROLLBACK LEVEL 2: Quick (Days)                                    │
│   ─────────────────────────────                                     │
│   • Revert to previous git commit                                    │
│   • `git revert HEAD~5..HEAD` for last 5 commits                     │
│   • Preserve history and checkpoints                                 │
│   • Test: 2 hours                                                   │
│                                                                      │
│   ROLLBACK LEVEL 3: Full Revert (Weeks)                             │
│   ─────────────────────────────────                                 │
│   • `git checkout <previous-version>`                                │
│   • Restore from backup if needed                                    │
│   • Test: 1 day                                                     │
│                                                                      │
│   EMERGENCY PROCEDURES:                                             │
│   ────────────────────                                              │
│   1. Checkpoint before every write operation                         │
│   2. Log all parallel execution events                               │
│   3. Monitor error rates during rollout                              │
│   4. Auto-rollback if error rate > 5%                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. الاختبارات (Testing)

### 4.1 Unit Tests

#### 4.1.1 Test Suite 1: ToolDependencyGraphBuilder

```typescript
// src/core/tools/dependency-graph/__tests__/ToolDependencyGraphBuilder.spec.ts

describe("ToolDependencyGraphBuilder", () => {
	let builder: ToolDependencyGraphBuilder

	beforeEach(() => {
		builder = new ToolDependencyGraphBuilder()
	})

	describe("Independent Tools", () => {
		it("should run read_file and list_files in parallel", () => {
			const toolUses = [
				{ id: "1", name: "read_file", params: { path: "a.txt" } },
				{ id: "2", name: "list_files", params: { path: "src" } },
				{ id: "3", name: "codebase_search", params: { query: "test" } },
			]

			const graph = builder.build(toolUses, {
				mode: "code",
				customModes: [],
				experiments: {},
			})

			expect(graph.requiresSequentialExecution).toBe(false)
			expect(graph.executionGroups.length).toBe(1)
			expect(graph.executionGroups[0].length).toBe(3)
		})
	})

	describe("Dependent Tools", () => {
		it("should run write_file before read_file for same file", () => {
			const toolUses = [
				{ id: "1", name: "write_to_file", params: { path: "a.txt", content: "test" } },
				{ id: "2", name: "read_file", params: { path: "a.txt" } },
			]

			const graph = builder.build(toolUses, {
				mode: "code",
				customModes: [],
				experiments: {},
			})

			expect(graph.executionGroups.length).toBe(2)
			expect(graph.executionGroups[0][0].id).toBe("1")
			expect(graph.executionGroups[1][0].id).toBe("2")
		})
	})

	describe("Exclusive Tools", () => {
		it("should require sequential execution for new_task", () => {
			const toolUses = [
				{ id: "1", name: "read_file", params: { path: "a.txt" } },
				{ id: "2", name: "new_task", params: { mode: "code", message: "test" } },
				{ id: "3", name: "read_file", params: { path: "b.txt" } },
			]

			const graph = builder.build(toolUses, {
				mode: "code",
				customModes: [],
				experiments: {},
			})

			expect(graph.requiresSequentialExecution).toBe(true)
		})
	})

	describe("Complex Dependencies", () => {
		it("should handle mixed dependencies correctly", () => {
			const toolUses = [
				{ id: "1", name: "read_file", params: { path: "a.txt" } },
				{ id: "2", name: "read_file", params: { path: "b.txt" } },
				{ id: "3", name: "write_to_file", params: { path: "c.txt", content: "from a and b" } },
				{ id: "4", name: "read_file", params: { path: "c.txt" } },
			]

			const graph = builder.build(toolUses, {
				mode: "code",
				customModes: [],
				experiments: {},
			})

			// Group 1: read_file a, read_file b (parallel)
			// Group 2: write_to_file c (depends on both reads)
			// Group 3: read_file c (depends on write)
			expect(graph.executionGroups.length).toBe(3)
		})
	})

	describe("Edge Cases", () => {
		it("should handle circular dependencies", () => {
			const toolUses = [
				{ id: "1", name: "read_file", params: { path: "a.txt" } },
				{ id: "2", name: "write_to_file", params: { path: "b.txt", content: "from a" } },
				{ id: "3", name: "read_file", params: { path: "b.txt" } },
				{ id: "4", name: "write_to_file", params: { path: "a.txt", content: "from b" } },
			]

			// Should not throw and should resolve
			const graph = builder.build(toolUses, {
				mode: "code",
				customModes: [],
				experiments: {},
			})

			expect(graph.nodes.size).toBe(4)
		})

		it("should handle empty tool list", () => {
			const graph = builder.build([], {
				mode: "code",
				customModes: [],
				experiments: {},
			})

			expect(graph.nodes.size).toBe(0)
			expect(graph.executionGroups.length).toBe(0)
		})
	})
})
```

---

#### 4.1.2 Test Suite 2: ParallelToolExecutor

```typescript
// src/core/tools/executor/__tests__/ParallelToolExecutor.spec.ts

describe("ParallelToolExecutor", () => {
	let executor: ParallelToolExecutor
	let mockTask: any

	beforeEach(() => {
		mockTask = {
			say: jest.fn(),
			ask: jest.fn(),
			checkpointSave: jest.fn().mockResolvedValue(undefined),
			pushToolResultToUserContent: jest.fn(),
		}

		executor = new ParallelToolExecutor(mockTask)
	})

	describe("Execution", () => {
		it("should execute independent tools in parallel", async () => {
			const toolUses = [
				createMockToolUse("1", "read_file", { path: "a.txt" }),
				createMockToolUse("2", "list_files", { path: "src" }),
				createMockToolUse("3", "codebase_search", { query: "test" }),
			]

			const result = await executor.execute(toolUses, "code", [], {})

			expect(result.allSuccessful).toBe(true)
			expect(result.results.length).toBe(3)
			expect(result.totalDuration).toBeLessThan(2000) // Should be fast due to parallel
		})

		it("should respect maxConcurrentTools limit", async () => {
			const executor = new ParallelToolExecutor(mockTask, {
				maxConcurrentTools: 2,
			})

			const toolUses = [
				createMockToolUse("1", "read_file", { path: "a.txt" }),
				createMockToolUse("2", "list_files", { path: "src" }),
				createMockToolUse("3", "codebase_search", { query: "test" }),
			]

			const startTime = Date.now()
			const result = await executor.execute(toolUses, "code", [], {})
			const duration = Date.now() - startTime

			// With 2 concurrent and 3 tools, should take longer than 1 concurrent
			expect(result.allSuccessful).toBe(true)
		})

		it("should save checkpoint before write tools", async () => {
			const toolUses = [
				createMockToolUse("1", "read_file", { path: "a.txt" }),
				createMockToolUse("2", "write_to_file", { path: "b.txt", content: "test" }),
			]

			await executor.execute(toolUses, "code", [], {})

			expect(mockTask.checkpointSave).toHaveBeenCalledTimes(1)
		})
	})

	describe("Error Handling", () => {
		it("should stop on first error when continueOnError is false", async () => {
			const executor = new ParallelToolExecutor(mockTask, {
				continueOnError: false,
			})

			const toolUses = [
				createMockToolUse("1", "read_file", { path: "a.txt" }),
				createMockToolUse("2", "invalid_tool", {}), // Will fail
				createMockToolUse("3", "read_file", { path: "c.txt" }),
			]

			const result = await executor.execute(toolUses, "code", [], {})

			expect(result.hasFailures).toBe(true)
			// The third tool should not have been attempted
			expect(result.results.length).toBeLessThan(3)
		})

		it("should continue on error when continueOnError is true", async () => {
			const executor = new ParallelToolExecutor(mockTask, {
				continueOnError: true,
			})

			const toolUses = [
				createMockToolUse("1", "read_file", { path: "a.txt" }),
				createMockToolUse("2", "invalid_tool", {}),
				createMockToolUse("3", "read_file", { path: "c.txt" }),
			]

			const result = await executor.execute(toolUses, "code", [], {})

			expect(result.hasFailures).toBe(true)
			expect(result.results.length).toBe(3)
		})
	})

	describe("Abort", () => {
		it("should abort all running tools", async () => {
			const toolUses = [
				createMockToolUse("1", "read_file", { path: "a.txt" }),
				createMockToolUse("2", "read_file", { path: "b.txt" }),
				createMockToolUse("3", "read_file", { path: "c.txt" }),
			]

			const executionPromise = executor.execute(toolUses, "code", [], {})

			// Abort after a short delay
			setTimeout(() => executor.abort(), 100)

			const result = await executionPromise

			// Should have been aborted
			expect(result.results.some((r) => !r.success)).toBe(true)
		})
	})
})

function createMockToolUse(id: string, name: string, params: any): ToolUse {
	return {
		type: "tool_use",
		id,
		name: name as ToolName,
		params,
		partial: false,
	}
}
```

---

#### 4.1.3 Test Suite 3: Semaphore

```typescript
// src/core/tools/executor/__tests__/Semaphore.spec.ts

describe("Semaphore", () => {
	it("should acquire and release permits", async () => {
		const semaphore = new Semaphore(2)

		await semaphore.acquire()
		expect(semaphore["permits"]).toBe(1)

		semaphore.release()
		expect(semaphore["permits"]).toBe(2)
	})

	it("should block when no permits available", async () => {
		const semaphore = new Semaphore(1)

		await semaphore.acquire() // First acquire
		expect(semaphore["permits"]).toBe(0)

		let secondAcquired = false
		const secondPromise = semaphore.acquire().then(() => {
			secondAcquired = true
		})

		// Should not be acquired yet
		expect(secondAcquired).toBe(false)

		semaphore.release()
		await secondPromise

		expect(secondAcquired).toBe(true)
	})

	it("should handle multiple concurrent acquires", async () => {
		const semaphore = new Semaphore(3)
		const acquired: number[] = []

		const promises = Array.from({ length: 5 }, async (_, i) => {
			await semaphore.acquire()
			acquired.push(i)
			await delay(50)
			semaphore.release()
		})

		await Promise.all(promises)

		// Should have acquired all 5
		expect(acquired.length).toBe(5)
		// First 3 should be acquired before any release
		expect(acquired.slice(0, 3).sort()).toEqual([0, 1, 2])
	})
})
```

---

### 4.2 Integration Tests

```typescript
// src/core/task/__tests__/parallel-execution.integration.spec.ts

describe("Parallel Tool Execution Integration", () => {
	let task: Task

	beforeEach(() => {
		// Setup test task with parallel execution enabled
		task = createMockTask({
			experiments: {
				parallelToolExecution: true,
			},
		})
	})

	describe("End-to-End Flow", () => {
		it("should handle multiple tools with dependencies", async () => {
			const assistantContent = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "read_file", { path: "b.txt" }),
				createToolUse("3", "write_to_file", { path: "c.txt", content: "combined" }),
			]

			// Simulate streaming completion
			task.currentStreamingContentIndex = 0
			task.assistantMessageContent = assistantContent

			// Execute tools
			await task.executeAssistantMessageTools()

			// Verify checkpoint was saved
			expect(task.checkpointSave).toHaveBeenCalled()

			// Verify results in correct order
			const results = task.getToolResults()
			expect(results.length).toBe(3)
		})

		it("should handle delegation with parallel tools", async () => {
			const assistantContent = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "new_task", { mode: "code", message: "process" }),
			]

			// new_task should be detected as exclusive
			const graph = task.buildDependencyGraph(assistantContent)
			expect(graph.hasExclusiveTools).toBe(true)

			// Should fall back to sequential
			await task.executeAssistantMessageTools()
		})
	})

	describe("Error Recovery", () => {
		it("should recover from tool failure", async () => {
			const assistantContent = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "read_file", { path: "nonexistent.txt" }), // Will fail
				createToolUse("3", "read_file", { path: "c.txt" }),
			]

			await task.executeAssistantMessageTools()

			// Third tool should still be attempted if continueOnError
			const results = task.getToolResults()
			expect(results.length).toBe(3)
		})

		it("should preserve checkpoint on error", async () => {
			const assistantContent = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "write_to_file", { path: "b.txt", content: "test" }),
				createToolUse("3", "read_file", { path: "invalid" }), // Will fail
			]

			await task.executeAssistantMessageTools()

			// Checkpoint should be saved before write
			expect(task.checkpointSave).toHaveBeenCalled()
		})
	})

	describe("State Management", () => {
		it("should track per-tool state correctly", async () => {
			const assistantContent = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "list_files", { path: "src" }),
			]

			// Before execution
			expect(task.executingToolIds.size).toBe(0)

			// During execution
			const executionPromise = task.executeAssistantMessageTools()
			await delay(10)

			expect(task.executingToolIds.size).toBeGreaterThan(0)

			// After execution
			await executionPromise

			expect(task.executingToolIds.size).toBe(0)
			expect(task.completedToolIds.size).toBe(2)
		})
	})
})
```

---

### 4.3 Edge Cases Tests

```typescript
// src/core/tools/__tests__/parallel-execution-edge-cases.spec.ts

describe("Parallel Tool Execution Edge Cases", () => {
	describe("Mixed Dependency Types", () => {
		it("should handle file, tool, and checkpoint dependencies", async () => {
			// Complex scenario with multiple dependency types
			const toolUses = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "read_file", { path: "b.txt" }),
				createToolUse("3", "write_to_file", { path: "c.txt", content: "from a and b" }),
				createToolUse("4", "checkpoint_save"), // Depends on write
				createToolUse("5", "new_task", { mode: "code", message: "process c" }),
			]

			const graph = buildDependencyGraph(toolUses)

			// Should create 4 groups
			expect(graph.executionGroups.length).toBe(4)
		})
	})

	describe("Many Tools", () => {
		it("should handle many parallel tools efficiently", async () => {
			const toolUses = Array.from({ length: 20 }, (_, i) =>
				createToolUse(`${i}`, "read_file", { path: `file${i}.txt` }),
			)

			const executor = new ParallelToolExecutor(mockTask, {
				maxConcurrentTools: 5,
			})

			const result = await executor.execute(toolUses, "code", [], {})

			expect(result.totalDuration).toBeLessThan(5000)
			expect(result.allSuccessful).toBe(true)
		})
	})

	describe("Timeout Handling", () => {
		it("should timeout long-running tools", async () => {
			const toolUses = [
				createToolUse("1", "read_file", { path: "a.txt" }),
				createToolUse("2", "execute_command", { command: "sleep 10" }), // Long command
			]

			const executor = new ParallelToolExecutor(mockTask, {
				timeoutPerTool: 1000, // 1 second timeout
			})

			const result = await executor.execute(toolUses, "code", [], {})

			expect(result.results[1].success).toBe(false)
			expect(result.results[1].error?.name).toBe("TimeoutError")
		})
	})

	describe("Race Conditions", () => {
		it("should handle rapid tool completions", async () => {
			const toolUses = Array.from({ length: 10 }, (_, i) =>
				createToolUse(`${i}`, "read_file", { path: `file${i}.txt` }),
			)

			// Simulate rapid completions
			mockToolHandler = async () => delay(Math.random() * 10)

			const result = await executeTools(toolUses)

			// All should complete without errors
			expect(result.hasFailures).toBe(false)
		})

		it("should preserve result order despite completion timing", async () => {
			const toolUses = Array.from({ length: 5 }, (_, i) =>
				createToolUse(`${i}`, "read_file", { path: `file${i}.txt` }),
			)

			// Random delays to simulate different execution times
			mockToolHandler = async (toolId: string) => {
				const delay = Math.random() * 100
				await delay(delay)
				return `Result for ${toolId}`
			}

			const result = await executeTools(toolUses)

			// Results should be in order
			const order = result.results.map((r) => r.toolUseId)
			expect(order).toEqual(["0", "1", "2", "3", "4"])
		})
	})
})
```

---

### 4.4 ملخص الاختبارات

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TEST SUMMARY                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   UNIT TESTS (src/core/tools/*/__tests__)                          │
│   ──────────────────────────────────────────                        │
│   │ Test Suite                    │ Lines │ Tests │ Coverage Target │ │
│   ├────────────────────────────────┼───────┼───────┼─────────────────┤
│   │ ToolDependencyGraphBuilder    │  200  │  15   │     95%         │
│   │ │  100  │   ToolDependencyResolver        8   │     95%         │
│   │ ParallelToolExecutor          │  300  │  20   │     95%         │
│   │ Semaphore                     │   80  │   6   │     100%        │
│   │ ToolExecutionResult           │   50  │   4   │     100%        │
│   ├────────────────────────────────┼───────┼───────┼─────────────────┤
│   │ TOTAL                          │  730  │  53   │     95%         │
│                                                                      │
│   INTEGRATION TESTS (src/core/task/__tests__)                      │
│   ─────────────────────────────────────────────────                  │
│   │ Test Suite                    │ Lines │ Tests │ Coverage Target │ │
│   ├────────────────────────────────┼───────┼───────┼─────────────────┤
│   │ parallel-execution            │  200  │  12   │     90%         │
│   │ checkpoint-integration        │  150  │   8   │     90%         │
│   │ delegation-integration        │  120  │   6   │     90%         │
│   ├────────────────────────────────┼───────┼───────┼─────────────────┤
│   │ TOTAL                          │  470  │  26   │     90%         │
│                                                                      │
│   E2E TESTS                                                         │
│   ─────────                                                         │
│   │ Browser-based tests for UI flow                                 │
│   │ Manual testing scenarios                                        │
│   │ Performance benchmarks                                          │
│                                                                      │
│   ESTIMATED TESTING TIME: ~4 hours                                  │
│   ESTIMATED CODE CHANGES: ~1,200 lines                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. ضمان عدم الكسر (Breaking Changes Prevention)

### 5.1 Backward Compatibility Checks

```typescript
// Configuration to maintain backward compatibility
const BACKWARD_COMPATIBILITY_CONFIG = {
	// Default to sequential execution for safety
	defaultExecutionMode: "sequential" as "sequential" | "parallel",

	// Feature flag to enable parallel execution
	featureFlag: "roo.parallelToolExecution.enabled",

	// Per-tool compatibility checks
	compatibleTools: ["read_file", "list_files", "search_files", "codebase_search", "read_command_output"],

	// Tools that always require sequential execution
	sequentialOnlyTools: ["new_task", "attempt_completion", "switch_mode", "run_slash_command", "skill"],

	// Tools that need special handling
	specialHandlingTools: {
		browser_action: { maxConcurrent: 1, checkpointBefore: true },
		execute_command: { maxConcurrent: 1, checkpointBefore: true },
		write_to_file: { maxConcurrent: 2, checkpointBefore: true },
		apply_diff: { maxConcurrent: 2, checkpointBefore: true },
		generate_image: { maxConcurrent: 1, checkpointBefore: true },
	},

	// Validation before enabling parallel mode
	validationChecks: ["checkGitInstalled", "checkCheckpointService", "checkNoActiveEdits", "checkNoOpenDiffViews"],
}
```

---

### 5.2 Migration Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MIGRATION STRATEGY                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   PHASE 1: Development (Week 1-2)                                   │
│   ─────────────────────────────────                                 │
│   • Implement feature behind feature flag                            │
│   • Default to sequential execution                                  │
│   • Internal testing only                                            │
│   • No user-facing changes                                           │
│                                                                      │
│   PHASE 2: Alpha Testing (Week 3)                                   │
│   ────────────────────────────────                                   │
│   • Enable for internal team                                         │
│   • Collect telemetry                                                │
│   • Fix reported issues                                              │
│   • Still behind feature flag                                        │
│                                                                      │
│   PHASE 3: Beta Testing (Week 4)                                    │
│   ────────────────────────────                                       │
│   • Enable for 5% of users via staged rollout                        │
│   • Monitor error rates and performance                              │
│   • Collect user feedback                                            │
│   • Adjust configuration based on data                               │
│                                                                      │
│   PHASE 4: Gradual Rollout (Week 5-6)                               │
│   ─────────────────────────────────                                 │
│   • 25% users → 50% users → 100% users                               │
│   • Each stage: 2-3 days monitoring period                           │
│   • Auto-rollback if error rate > threshold                          │
│   • Feature flag can be disabled per user                            │
│                                                                      │
│   PHASE 5: GA (Week 7)                                               │
│   ────────────────────                                               │
│   • Feature enabled for all users                                    │
│   • Feature flag still available for opt-out                         │
│   • Full documentation and guides                                    │
│   • Deprecation warnings for old behavior                            │
│                                                                      │
│   PHASE 6: Cleanup (Week 8+)                                         │
│   ──────────────────────────                                         │
│   • Remove sequential-only fallback code                             │
│   • Clean up old feature flags                                       │
│   • Archive migration documentation                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 5.3 Emergency Rollback Procedure

```typescript
// Emergency rollback mechanism

/**
 * Emergency rollback manager
 */
class EmergencyRollbackManager {
	private static instance: EmergencyRollbackManager
	private rollbackInProgress: boolean = false

	private constructor() {}

	static getInstance(): EmergencyRollbackManager {
		if (!EmergencyRollbackManager.instance) {
			EmergencyRollbackManager.instance = new EmergencyRollbackManager()
		}
		return EmergencyRollbackManager.instance
	}

	/**
	 * Check if rollback should be triggered
	 */
	async checkRollbackCriteria(): Promise<boolean> {
		const errorRate = await this.getCurrentErrorRate()
		const latency = await this.getCurrentLatency()
		const userReports = await this.getUserReports()

		// Rollback thresholds
		const ERROR_RATE_THRESHOLD = 0.05 // 5%
		const LATENCY_THRESHOLD = 5000 // 5 seconds
		const USER_REPORTS_THRESHOLD = 10 // 10 reports in last hour

		if (errorRate > ERROR_RATE_THRESHOLD) {
			console.error(`High error rate detected: ${errorRate * 100}%`)
			return true
		}

		if (latency > LATENCY_THRESHOLD) {
			console.error(`High latency detected: ${latency}ms`)
			return true
		}

		if (userReports > USER_REPORTS_THRESHOLD) {
			console.error(`High user reports: ${userReports}`)
			return true
		}

		return false
	}

	/**
	 * Perform emergency rollback
	 */
	async performRollback(): Promise<void> {
		if (this.rollbackInProgress) {
			console.warn("Rollback already in progress")
			return
		}

		this.rollbackInProgress = true

		try {
			console.log("Starting emergency rollback...")

			// Step 1: Disable feature flag
			await this.disableParallelExecution()

			// Step 2: Clear any in-progress parallel executions
			this.abortAllParallelExecutions()

			// Step 3: Restore checkpoints if needed
			await this.ensureSafeCheckpoint()

			// Step 4: Notify users
			this.notifyUsersOfRollback()

			// Step 5: Log incident
			this.logRollbackIncident()

			console.log("Emergency rollback completed successfully")
		} catch (error) {
			console.error("Error during rollback:", error)
			throw error
		} finally {
			this.rollbackInProgress = false
		}
	}

	private async disableParallelExecution(): Promise<void> {
		// Set feature flag to false
		await this.updateFeatureFlag("roo.parallelToolExecution.enabled", false)
	}

	private abortAllParallelExecutions(): void {
		// Signal all running parallel executors to abort
		ParallelToolExecutor.abortAll()
	}

	private async ensureSafeCheckpoint(): Promise<void> {
		// Save a checkpoint at the current safe state
		await this.saveSafeCheckpoint()
	}

	private notifyUsersOfRollback(): void {
		// Post notification to webview
		this.postNotification({
			type: "rollback",
			message: "Parallel tool execution has been temporarily disabled due to an issue. We are working on a fix.",
		})
	}

	private logRollbackIncident(): void {
		// Log to telemetry
		TelemetryService.instance.captureEvent("parallel_execution_rollback", {
			timestamp: Date.now(),
			errorRate: this.getCurrentErrorRate(),
			// ... other metrics
		})
	}
}
```

---

### 5.4 Monitoring and Telemetry

```typescript
/**
 * Telemetry for parallel execution
 */
const PARALLEL_EXECUTION_TELEMETRY = {
  events: {
    parallelExecutionStarted: {
      fields: ['toolCount', 'concurrentLimit', 'mode'],
    },
    parallelExecutionCompleted: {
      fields: ['toolCount', 'duration', 'successCount', 'failureCount'],
    },
    parallelExecutionError: {
      fields: ['toolName', 'errorType', 'checkpointSaved'],
    },
    parallelExecutionFallback: {
      fields: ['reason', 'toolCount'],
    },
    checkpointCreated: {
      fields: ['beforeTool', 'afterTool', 'parallelContext'],
    },
  },

  metrics: {
    executionTime: 'avg',
    errorRate: 'ratio',
    toolCompletionRate: 'ratio',
    checkpointFrequency: 'count',
  },

  alerts: [
    { threshold: 0.05, metric: 'errorRate', severity: 'warning' },
    { threshold: 0.
```
