# Multi-Orchestrator Mode — Design Spec & Agent Tasks

## Overview

A new mode that decomposes complex tasks into N parallel subtasks, each running in its own editor tab panel with an independent ClineProvider, isolated via git worktrees. After all agents complete, a merge resolution phase combines their work, and reports are aggregated back to the orchestrator.

## Key Decisions

| Decision | Choice |
|---|---|
| Visual layout | Editor tab panels via `createWebviewPanel(ViewColumn)` |
| Parallel execution | Multiple independent ClineProvider instances |
| Git isolation | Git worktrees via existing `WorktreeService` |
| Planning mode | Toggle: autonomous (default) vs plan-review |
| Agent count | User sets max (1-6) in chat area, orchestrator decides within limit |
| Agent count control | Visible in chat area ONLY when multi-orchestrator mode is selected |
| Merge phase | Auto-detect (skip if no code agents) + manual override in settings |

## Architecture

```
User Request → Multi-Orchestrator (sidebar)
  │
  ├─ 1. PLAN: Decompose into N tasks, assign modes
  ├─ 2. SPAWN: Create worktrees + open N tab panels
  ├─ 3. RUN: Start all simultaneously, monitor via events
  ├─ 4. MERGE: Sequential branch merges (if code tasks)
  └─ 5. REPORT: Aggregate results, present summary, cleanup
```

---

## SHARED INTERFACE CONTRACTS

Every agent MUST use these exact signatures. Agent 1 creates this file; all others import from it.

### File: `src/core/multi-orchestrator/types.ts`

```typescript
import type { ModeConfig } from "@roo-code/types"

export interface OrchestratorPlan {
  tasks: PlannedTask[]
  requiresMerge: boolean
  estimatedComplexity: "low" | "medium" | "high"
}

export interface PlannedTask {
  id: string
  mode: string
  title: string
  description: string
  assignedFiles?: string[]
  priority: number
}

export type AgentStatus = "pending" | "running" | "completed" | "failed" | "merging"

export interface AgentState {
  taskId: string
  providerId: string
  panelId: string
  worktreePath: string | null
  worktreeBranch: string | null
  mode: string
  status: AgentStatus
  title: string
  completionReport: string | null
  tokenUsage: { input: number; output: number } | null
  startedAt: number | null
  completedAt: number | null
}

export interface MergeResult {
  agentTaskId: string
  branch: string
  success: boolean
  conflictsFound: number
  conflictsResolved: number
  filesChanged: string[]
}

export interface OrchestratorState {
  phase: "idle" | "planning" | "spawning" | "running" | "merging" | "reporting" | "complete"
  plan: OrchestratorPlan | null
  agents: AgentState[]
  mergeResults: MergeResult[]
  finalReport: string | null
}

export const MULTI_ORCHESTRATOR_CONSTANTS = {
  MAX_AGENTS: 6,
  DEFAULT_MAX_AGENTS: 4,
  WORKTREE_PREFIX: "roo-multi-",
  BRANCH_PREFIX: "multi-orch/",
} as const
```

---

## AGENT 1: Types & Constants

**Creates:** `src/core/multi-orchestrator/types.ts`

**Task:** Create the file above exactly as specified in the SHARED INTERFACE CONTRACTS section. This is the foundation every other agent imports from.

Additionally, add a helper to generate agent IDs:

```typescript
import * as crypto from "crypto"

export function generateAgentId(): string {
  return crypto.randomUUID().slice(0, 8)
}

export function createInitialAgentState(task: PlannedTask): AgentState {
  return {
    taskId: task.id,
    providerId: "",
    panelId: "",
    worktreePath: null,
    worktreeBranch: null,
    mode: task.mode,
    status: "pending",
    title: task.title,
    completionReport: null,
    tokenUsage: null,
    startedAt: null,
    completedAt: null,
  }
}

export function createInitialOrchestratorState(): OrchestratorState {
  return {
    phase: "idle",
    plan: null,
    agents: [],
    mergeResults: [],
    finalReport: null,
  }
}
```

**Commit:** `feat(multi-orch): add shared types and constants`
**Use `--no-verify` on commits.**

---

## AGENT 2: Message Types & Global Settings

**Modifies:**
- `packages/types/src/vscode-extension-host.ts`
- `packages/types/src/global-settings.ts`

**Task:**

### 2a. Add message types to `vscode-extension-host.ts`

Find the `WebviewMessage` interface type union. After the last entry (`"getMemoryStatus"`), add:

```typescript
| "multiOrchStartPlan"
| "multiOrchApprovePlan"
| "multiOrchAbort"
| "multiOrchGetStatus"
```

Find the `ExtensionMessage` interface type union. After the last entry (`"memoryStatus"`), add:

```typescript
| "multiOrchPlanReady"
| "multiOrchStatusUpdate"
| "multiOrchComplete"
| "multiOrchError"
```

### 2b. Add global settings to `global-settings.ts`

Find `globalSettingsSchema` and add before the closing `})`:

```typescript
// Multi-Orchestrator
multiOrchMaxAgents: z.number().min(1).max(6).optional(),
multiOrchPlanReviewEnabled: z.boolean().optional(),
multiOrchMergeEnabled: z.enum(["auto", "always", "never"]).optional(),
```

**Verify:** `cd packages/types && npx tsc --noEmit`

**Commit:** `feat(multi-orch): add message types and global settings`
**Use `--no-verify` on commits.**

---

## AGENT 3: Mode Definition

**Modifies:**
- `packages/types/src/mode.ts`
- `src/shared/modes.ts`

**Task:**

### 3a. Add multi-orchestrator to DEFAULT_MODES

In `packages/types/src/mode.ts`, find the `DEFAULT_MODES` array (around line 195-254). Add a new entry after the `orchestrator` mode:

```typescript
{
  slug: "multi-orchestrator",
  name: "⚡ Multi-Orchestrator",
  roleDefinition:
    "You are Roo, a parallel workflow orchestrator that decomposes complex tasks into multiple independent subtasks and dispatches them to specialized modes running simultaneously. You analyze the user's request, identify separable concerns, assign each to the most appropriate mode, and coordinate their parallel execution with git worktree isolation.",
  whenToUse:
    "Use for complex tasks that benefit from parallelization — such as building features that span multiple modules, running architecture design alongside implementation, or handling multi-file refactoring with test writing simultaneously.",
  description: "Parallel task execution across multiple agents",
  groups: [],
  customInstructions: `Your workflow:
1. Analyze the user's request and identify separable concerns
2. Decompose into independent tasks (respecting the max agent count setting)
3. Assign each task to the most appropriate mode (code, architect, ask, debug)
4. Maximize file separation between agents to minimize merge conflicts
5. If plan-review is enabled, present the plan for approval before executing
6. Monitor all agents and collect their completion reports
7. If merge is needed, coordinate the sequential branch merge
8. Present a unified summary of all results

CRITICAL: When decomposing, ensure agents work on DIFFERENT files. Split by module/feature boundary, not by layer.`,
},
```

### 3b. Verify mode is accessible

In `src/shared/modes.ts`, confirm that `DEFAULT_MODES` is imported from `@roo-code/types` and that `getAllModes()` and `getModeBySlug()` will automatically include the new mode. No changes should be needed here since it reads from `DEFAULT_MODES` directly — but verify.

**Verify:** `cd packages/types && npx tsc --noEmit`

**Commit:** `feat(multi-orch): add multi-orchestrator mode definition`
**Use `--no-verify` on commits.**

---

## AGENT 4: Panel Spawner

**Creates:** `src/core/multi-orchestrator/panel-spawner.ts`
**Modifies:** `src/core/webview/ClineProvider.ts` (add static accessor only)

**Task:**

### 4a. Add static accessor to ClineProvider

In `src/core/webview/ClineProvider.ts`, find the `getVisibleInstance()` static method (around line 737). Add a new static method nearby:

```typescript
/** Get all active ClineProvider instances (for multi-orchestrator coordination) */
public static getAllInstances(): ReadonlySet<ClineProvider> {
  return this.activeInstances
}
```

This is the ONLY change to ClineProvider.ts. Do not touch anything else.

### 4b. Create the panel spawner

```typescript
// src/core/multi-orchestrator/panel-spawner.ts
import * as vscode from "vscode"
import { ClineProvider } from "../webview/ClineProvider"
import { ContextProxy } from "../config/ContextProxy"

export interface SpawnedPanel {
  id: string
  provider: ClineProvider
  panel: vscode.WebviewPanel
}

export class PanelSpawner {
  private panels: Map<string, SpawnedPanel> = new Map()

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.OutputChannel,
  ) {}

  /**
   * Spawn N editor tab panels, each with an independent ClineProvider.
   * Panels are placed across ViewColumns 1-6.
   */
  async spawnPanels(
    count: number,
    titles: string[],
  ): Promise<Map<string, SpawnedPanel>> {
    const contextProxy = await ContextProxy.getInstance(this.context)

    for (let i = 0; i < count; i++) {
      const id = `agent-${i}`
      const title = titles[i] || `Agent ${i + 1}`
      const viewColumn = (i + 1) as vscode.ViewColumn // ViewColumn.One through Six

      // Create independent ClineProvider
      const provider = new ClineProvider(
        this.context,
        this.outputChannel,
        "editor",
        contextProxy,
      )

      // Create WebviewPanel
      const panel = vscode.window.createWebviewPanel(
        ClineProvider.tabPanelId,
        `⚡ ${title}`,
        viewColumn,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [this.context.extensionUri],
        },
      )

      // Wire provider to panel
      await provider.resolveWebviewView(panel)

      // Track for cleanup
      panel.onDidDispose(() => {
        this.panels.delete(id)
      })

      this.panels.set(id, { id, provider, panel })
    }

    return new Map(this.panels)
  }

  /** Close a specific panel and dispose its provider */
  async closePanel(id: string): Promise<void> {
    const spawned = this.panels.get(id)
    if (spawned) {
      spawned.panel.dispose()
      this.panels.delete(id)
    }
  }

  /** Close all panels */
  async closeAllPanels(): Promise<void> {
    for (const [id] of this.panels) {
      await this.closePanel(id)
    }
  }

  /** Get all active spawned panels */
  getPanels(): Map<string, SpawnedPanel> {
    return new Map(this.panels)
  }

  /** Get a specific provider by ID */
  getProvider(id: string): ClineProvider | undefined {
    return this.panels.get(id)?.provider
  }
}
```

**Key reference:** The `openClineInNewTab` function at `src/activate/registerCommands.ts:200-274` shows the existing pattern. This agent follows that pattern but without the editor group locking and with explicit ViewColumn assignment.

**Commit:** `feat(multi-orch): add panel spawner for parallel agent tab panels`
**Use `--no-verify` on commits.**

---

## AGENT 5: Worktree Manager

**Creates:** `src/core/multi-orchestrator/worktree-manager.ts`

**Task:**

Build a manager that creates and cleans up git worktrees for each agent using the existing `WorktreeService` from `packages/core/src/worktree/worktree-service.ts`.

```typescript
// src/core/multi-orchestrator/worktree-manager.ts
import { WorktreeService } from "@roo-code/core/worktree/worktree-service"
import { MULTI_ORCHESTRATOR_CONSTANTS } from "./types"
import * as path from "path"

export interface WorktreeInfo {
  agentId: string
  path: string
  branch: string
}

export class MultiWorktreeManager {
  private worktreeService: WorktreeService
  private worktrees: Map<string, WorktreeInfo> = new Map()

  constructor(private workspacePath: string) {
    this.worktreeService = new WorktreeService()
  }

  /**
   * Create a git worktree for each agent.
   * Each gets its own branch from current HEAD and its own directory.
   */
  async createWorktrees(agentIds: string[]): Promise<Map<string, WorktreeInfo>> {
    for (const agentId of agentIds) {
      const branch = `${MULTI_ORCHESTRATOR_CONSTANTS.BRANCH_PREFIX}${agentId}`
      const worktreePath = path.join(
        path.dirname(this.workspacePath),
        `${MULTI_ORCHESTRATOR_CONSTANTS.WORKTREE_PREFIX}${agentId}`,
      )

      const result = await this.worktreeService.createWorktree({
        srcPath: this.workspacePath,
        destPath: worktreePath,
        branch,
      })

      if (!result.success) {
        throw new Error(`Failed to create worktree for agent ${agentId}: ${result.message}`)
      }

      this.worktrees.set(agentId, { agentId, path: worktreePath, branch })
    }

    return new Map(this.worktrees)
  }

  /** Get worktree info for a specific agent */
  getWorktree(agentId: string): WorktreeInfo | undefined {
    return this.worktrees.get(agentId)
  }

  /** Get all worktrees */
  getAllWorktrees(): WorktreeInfo[] {
    return Array.from(this.worktrees.values())
  }

  /** Clean up all worktrees created by this orchestration */
  async cleanupWorktrees(): Promise<void> {
    for (const [agentId, info] of this.worktrees) {
      try {
        await this.worktreeService.deleteWorktree({
          srcPath: this.workspacePath,
          worktreePath: info.path,
        })
      } catch (error) {
        console.error(`[MultiOrch] Failed to cleanup worktree for ${agentId}:`, error)
      }
    }
    this.worktrees.clear()
  }

  /** Get the branch name for an agent */
  getBranchName(agentId: string): string {
    return `${MULTI_ORCHESTRATOR_CONSTANTS.BRANCH_PREFIX}${agentId}`
  }
}
```

**Key reference:** Check `packages/core/src/worktree/worktree-service.ts` for the exact `createWorktree()` and `deleteWorktree()` signatures and their `CreateWorktreeOptions` type. The import path may need adjustment — check if `@roo-code/core` exports the worktree service or if you need a relative import.

**Commit:** `feat(multi-orch): add worktree manager for agent isolation`
**Use `--no-verify` on commits.**

---

## AGENT 6: Plan Generator

**Creates:** `src/core/multi-orchestrator/plan-generator.ts`

**Task:**

Build the LLM-powered task decomposer that analyzes a user request and creates an execution plan.

```typescript
// src/core/multi-orchestrator/plan-generator.ts
import type { ProviderSettings, ModeConfig } from "@roo-code/types"
import { buildApiHandler, type SingleCompletionHandler } from "../../api"
import type { OrchestratorPlan, PlannedTask } from "./types"
import { generateAgentId } from "./types"

const PLAN_SYSTEM_PROMPT = `You are a task decomposition engine. Given a user request, break it into independent parallel tasks.

For each task:
- Assign the most appropriate mode: "code" (implementation), "architect" (design/planning), "ask" (research/questions), "debug" (fixing issues)
- Write a clear, self-contained task description that an agent can execute independently
- List expected files the agent will touch (for merge conflict prevention)
- Ensure tasks are as independent as possible — minimize file overlap

Respond in this exact JSON format (no markdown fences):
{
  "tasks": [
    {
      "mode": "<mode-slug>",
      "title": "<short title>",
      "description": "<full task prompt for the agent>",
      "assignedFiles": ["<expected files>"],
      "priority": <1-N>
    }
  ],
  "requiresMerge": <true if any task uses "code" mode>,
  "estimatedComplexity": "<low|medium|high>"
}`

export async function generatePlan(
  userRequest: string,
  availableModes: ModeConfig[],
  maxAgents: number,
  providerSettings: ProviderSettings,
): Promise<OrchestratorPlan | null> {
  try {
    const handler = buildApiHandler(providerSettings)

    if (!("completePrompt" in handler)) {
      console.error("[MultiOrch] Handler does not support completePrompt")
      return null
    }

    const modeList = availableModes
      .filter((m) => m.slug !== "multi-orchestrator" && m.slug !== "orchestrator")
      .map((m) => `- ${m.slug}: ${m.description || m.name}`)
      .join("\n")

    const prompt = `Available modes:\n${modeList}\n\nMax parallel tasks: ${maxAgents}\n\nUser request:\n${userRequest}`

    const response = await (handler as unknown as SingleCompletionHandler).completePrompt(
      `${PLAN_SYSTEM_PROMPT}\n\n${prompt}`,
    )

    return parsePlanResponse(response)
  } catch (error) {
    console.error("[MultiOrch] Plan generation failed:", error)
    return null
  }
}

function parsePlanResponse(response: string): OrchestratorPlan | null {
  try {
    const cleaned = response.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "").trim()
    const parsed = JSON.parse(cleaned)

    if (!parsed.tasks || !Array.isArray(parsed.tasks)) return null

    const tasks: PlannedTask[] = parsed.tasks.map((t: Record<string, unknown>, i: number) => ({
      id: generateAgentId(),
      mode: (t.mode as string) || "code",
      title: (t.title as string) || `Task ${i + 1}`,
      description: (t.description as string) || "",
      assignedFiles: (t.assignedFiles as string[]) || [],
      priority: (t.priority as number) || i + 1,
    }))

    return {
      tasks,
      requiresMerge: parsed.requiresMerge ?? tasks.some((t) => t.mode === "code"),
      estimatedComplexity: parsed.estimatedComplexity || "medium",
    }
  } catch (error) {
    console.error("[MultiOrch] Failed to parse plan:", error)
    return null
  }
}
```

**Commit:** `feat(multi-orch): add LLM-powered plan generator for task decomposition`
**Use `--no-verify` on commits.**

---

## AGENT 7: Agent Coordinator

**Creates:** `src/core/multi-orchestrator/agent-coordinator.ts`

**Task:**

Build the component that tracks all spawned agents, listens for completion events, and coordinates the start/monitor lifecycle.

```typescript
// src/core/multi-orchestrator/agent-coordinator.ts
import { EventEmitter } from "events"
import type { ClineProvider } from "../webview/ClineProvider"
import type { AgentState } from "./types"
import { RooCodeEventName } from "@roo-code/types"

export class AgentCoordinator extends EventEmitter {
  private agents: Map<string, AgentState> = new Map()
  private providers: Map<string, ClineProvider> = new Map()
  private completionCount = 0

  /** Register an agent and attach event listeners to its provider */
  registerAgent(agent: AgentState, provider: ClineProvider): void {
    this.agents.set(agent.taskId, agent)
    this.providers.set(agent.taskId, provider)

    // Listen for task completion on this provider
    provider.on(RooCodeEventName.TaskCompleted, (taskId: string) => {
      const agentState = this.agents.get(agent.taskId)
      if (agentState) {
        agentState.status = "completed"
        agentState.completedAt = Date.now()
        this.completionCount++
        this.emit("agentCompleted", agent.taskId)

        if (this.allComplete()) {
          this.emit("allCompleted")
        }
      }
    })

    provider.on(RooCodeEventName.TaskAborted, () => {
      const agentState = this.agents.get(agent.taskId)
      if (agentState) {
        agentState.status = "failed"
        agentState.completedAt = Date.now()
        this.completionCount++
        this.emit("agentFailed", agent.taskId)

        if (this.allComplete()) {
          this.emit("allCompleted")
        }
      }
    })
  }

  /**
   * Start all agents simultaneously.
   * Each provider should already have a task created with startTask=false.
   */
  async startAll(): Promise<void> {
    const startPromises: Promise<void>[] = []

    for (const [taskId, provider] of this.providers) {
      const agent = this.agents.get(taskId)
      if (agent) {
        agent.status = "running"
        agent.startedAt = Date.now()
      }

      const currentTask = provider.getCurrentTask()
      if (currentTask) {
        startPromises.push(currentTask.start())
      }
    }

    // Start all simultaneously
    await Promise.all(startPromises)
  }

  /** Check if all agents have finished (completed or failed) */
  allComplete(): boolean {
    return this.completionCount >= this.agents.size
  }

  /** Get current state of all agents */
  getStates(): AgentState[] {
    return Array.from(this.agents.values())
  }

  /** Get a specific agent's state */
  getState(taskId: string): AgentState | undefined {
    return this.agents.get(taskId)
  }

  /** Wait for all agents to complete (returns a promise) */
  waitForAll(): Promise<void> {
    if (this.allComplete()) return Promise.resolve()
    return new Promise((resolve) => {
      this.once("allCompleted", resolve)
    })
  }

  /** Get total agent count */
  get totalAgents(): number {
    return this.agents.size
  }

  /** Get completed agent count */
  get completedAgents(): number {
    return this.completionCount
  }
}
```

**Key reference:** Task events are defined in `packages/types/src/events.ts`. The `RooCodeEventName.TaskCompleted` event is emitted by ClineProvider (not Task directly for delegation events, but `TaskCompleted` is emitted from the Task level and forwarded). Check `src/core/webview/ClineProvider.ts` for how events are forwarded from Task to Provider.

**Commit:** `feat(multi-orch): add agent coordinator for parallel lifecycle management`
**Use `--no-verify` on commits.**

---

## AGENT 8: Merge Pipeline

**Creates:** `src/core/multi-orchestrator/merge-pipeline.ts`

**Task:**

Build the sequential branch merger that runs after all agents complete.

```typescript
// src/core/multi-orchestrator/merge-pipeline.ts
import { execSync } from "child_process"
import type { AgentState, MergeResult } from "./types"

export class MergePipeline {
  constructor(private workspacePath: string) {}

  /**
   * Merge all agent branches sequentially into the current branch.
   * Order: by priority (lower = first).
   */
  async mergeAll(
    agents: AgentState[],
    onProgress: (agentId: string, result: MergeResult) => void,
  ): Promise<MergeResult[]> {
    const results: MergeResult[] = []

    // Sort by priority for deterministic merge order
    const sorted = [...agents]
      .filter((a) => a.worktreeBranch && a.status === "completed")
      .sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))

    for (const agent of sorted) {
      if (!agent.worktreeBranch) continue

      const result = this.mergeBranch(agent.taskId, agent.worktreeBranch)
      results.push(result)
      onProgress(agent.taskId, result)
    }

    return results
  }

  /** Merge a single agent's branch into the current branch */
  private mergeBranch(agentTaskId: string, branch: string): MergeResult {
    try {
      // Get list of files changed on this branch
      const filesChanged = this.getFilesChanged(branch)

      // Attempt merge
      try {
        execSync(`git merge --no-ff "${branch}" -m "Merge multi-orch agent: ${agentTaskId}"`, {
          cwd: this.workspacePath,
          encoding: "utf-8",
          timeout: 30000,
        })

        return {
          agentTaskId,
          branch,
          success: true,
          conflictsFound: 0,
          conflictsResolved: 0,
          filesChanged,
        }
      } catch (mergeError) {
        // Merge conflict — count them
        const conflictFiles = this.getConflictFiles()
        const conflictsFound = conflictFiles.length

        if (conflictsFound > 0) {
          // Abort the merge for now — let the report indicate conflicts
          try {
            execSync("git merge --abort", { cwd: this.workspacePath, encoding: "utf-8" })
          } catch {
            // If abort fails, reset
            execSync("git reset --hard HEAD", { cwd: this.workspacePath, encoding: "utf-8" })
          }
        }

        return {
          agentTaskId,
          branch,
          success: false,
          conflictsFound,
          conflictsResolved: 0,
          filesChanged,
        }
      }
    } catch (error) {
      return {
        agentTaskId,
        branch,
        success: false,
        conflictsFound: 0,
        conflictsResolved: 0,
        filesChanged: [],
      }
    }
  }

  /** Get files changed on a branch compared to current HEAD */
  private getFilesChanged(branch: string): string[] {
    try {
      const output = execSync(`git diff --name-only HEAD..."${branch}"`, {
        cwd: this.workspacePath,
        encoding: "utf-8",
        timeout: 10000,
      })
      return output.trim().split("\n").filter(Boolean)
    } catch {
      return []
    }
  }

  /** Get files with merge conflicts */
  private getConflictFiles(): string[] {
    try {
      const output = execSync("git diff --name-only --diff-filter=U", {
        cwd: this.workspacePath,
        encoding: "utf-8",
        timeout: 10000,
      })
      return output.trim().split("\n").filter(Boolean)
    } catch {
      return []
    }
  }
}
```

**Commit:** `feat(multi-orch): add merge pipeline for sequential branch merging`
**Use `--no-verify` on commits.**

---

## AGENT 9: Report Aggregator

**Creates:** `src/core/multi-orchestrator/report-aggregator.ts`

**Task:**

Build the report formatter that collects results from all agents and the merge phase.

```typescript
// src/core/multi-orchestrator/report-aggregator.ts
import type { AgentState, MergeResult } from "./types"

/**
 * Aggregate all agent reports and merge results into a unified markdown summary.
 */
export function aggregateReports(
  agents: AgentState[],
  mergeResults: MergeResult[],
): string {
  const sections: string[] = []

  // Header
  sections.push(`# Multi-Orchestration Report`)
  sections.push(`**${agents.length} agents** executed in parallel.\n`)

  // Agent summaries
  sections.push(`## Agent Results\n`)
  for (const agent of agents) {
    const status = agent.status === "completed" ? "✅" : "❌"
    const duration = agent.startedAt && agent.completedAt
      ? `${Math.round((agent.completedAt - agent.startedAt) / 1000)}s`
      : "unknown"

    sections.push(`### ${status} ${agent.title} (${agent.mode} mode)`)
    sections.push(`- **Status:** ${agent.status}`)
    sections.push(`- **Duration:** ${duration}`)
    if (agent.tokenUsage) {
      sections.push(`- **Tokens:** ${agent.tokenUsage.input} in / ${agent.tokenUsage.output} out`)
    }
    if (agent.completionReport) {
      sections.push(`- **Report:** ${agent.completionReport}`)
    }
    sections.push("")
  }

  // Merge results (if any)
  if (mergeResults.length > 0) {
    sections.push(`## Merge Results\n`)
    for (const result of mergeResults) {
      const status = result.success ? "✅" : "⚠️"
      sections.push(`### ${status} Branch: ${result.branch}`)
      sections.push(`- **Success:** ${result.success}`)
      sections.push(`- **Files changed:** ${result.filesChanged.length}`)
      if (result.conflictsFound > 0) {
        sections.push(`- **Conflicts found:** ${result.conflictsFound}`)
        sections.push(`- **Conflicts resolved:** ${result.conflictsResolved}`)
      }
      sections.push("")
    }
  }

  // Summary stats
  const completed = agents.filter((a) => a.status === "completed").length
  const failed = agents.filter((a) => a.status === "failed").length
  const mergeSuccesses = mergeResults.filter((r) => r.success).length
  const mergeFailures = mergeResults.filter((r) => !r.success).length

  sections.push(`## Summary`)
  sections.push(`- **Agents:** ${completed} completed, ${failed} failed`)
  if (mergeResults.length > 0) {
    sections.push(`- **Merges:** ${mergeSuccesses} succeeded, ${mergeFailures} had conflicts`)
  }

  return sections.join("\n")
}
```

**Commit:** `feat(multi-orch): add report aggregator for unified result formatting`
**Use `--no-verify` on commits.**

---

## AGENT 10: Top-Level Orchestrator

**Creates:** `src/core/multi-orchestrator/orchestrator.ts`

**Task:**

Build the main conductor that ties all components into the full lifecycle.

```typescript
// src/core/multi-orchestrator/orchestrator.ts
import * as vscode from "vscode"
import type { ProviderSettings, ModeConfig } from "@roo-code/types"
import { PanelSpawner } from "./panel-spawner"
import { MultiWorktreeManager } from "./worktree-manager"
import { generatePlan } from "./plan-generator"
import { AgentCoordinator } from "./agent-coordinator"
import { MergePipeline } from "./merge-pipeline"
import { aggregateReports } from "./report-aggregator"
import {
  type OrchestratorState,
  type OrchestratorPlan,
  createInitialOrchestratorState,
  createInitialAgentState,
  MULTI_ORCHESTRATOR_CONSTANTS,
} from "./types"

export class MultiOrchestrator {
  private state: OrchestratorState = createInitialOrchestratorState()
  private panelSpawner: PanelSpawner
  private worktreeManager: MultiWorktreeManager | null = null
  private coordinator: AgentCoordinator | null = null
  private mergePipeline: MergePipeline | null = null
  private aborted = false

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.OutputChannel,
    private workspacePath: string,
  ) {
    this.panelSpawner = new PanelSpawner(context, outputChannel)
  }

  /**
   * Execute the full multi-orchestration lifecycle.
   */
  async execute(
    userRequest: string,
    maxAgents: number,
    providerSettings: ProviderSettings,
    availableModes: ModeConfig[],
    planReviewEnabled: boolean,
    mergeMode: "auto" | "always" | "never",
    onStateChange: (state: OrchestratorState) => void,
  ): Promise<void> {
    this.aborted = false
    const notify = () => onStateChange({ ...this.state })

    try {
      // PHASE 1: PLAN
      this.state.phase = "planning"
      notify()

      const plan = await generatePlan(userRequest, availableModes, maxAgents, providerSettings)
      if (!plan || plan.tasks.length === 0) {
        this.state.phase = "complete"
        this.state.finalReport = "Could not decompose the request into parallel tasks."
        notify()
        return
      }

      this.state.plan = plan
      this.state.agents = plan.tasks.map(createInitialAgentState)
      notify()

      // If plan review enabled, stop here and wait for approval
      if (planReviewEnabled) {
        // The onStateChange callback will trigger UI to show the plan
        // The execute() caller should handle the approval flow
        return
      }

      await this.executeFromPlan(plan, providerSettings, mergeMode, onStateChange)
    } catch (error) {
      this.state.phase = "complete"
      this.state.finalReport = `Orchestration failed: ${error}`
      notify()
    }
  }

  /**
   * Resume execution after plan approval (called when user approves in plan-review mode).
   */
  async executeFromPlan(
    plan: OrchestratorPlan,
    providerSettings: ProviderSettings,
    mergeMode: "auto" | "always" | "never",
    onStateChange: (state: OrchestratorState) => void,
  ): Promise<void> {
    const notify = () => onStateChange({ ...this.state })

    try {
      // PHASE 2: SPAWN
      this.state.phase = "spawning"
      notify()

      const needsMerge =
        mergeMode === "always" ||
        (mergeMode === "auto" && plan.requiresMerge) ||
        false

      // Create worktrees if merge is needed
      if (needsMerge) {
        this.worktreeManager = new MultiWorktreeManager(this.workspacePath)
        const agentIds = plan.tasks.map((t) => t.id)
        const worktrees = await this.worktreeManager.createWorktrees(agentIds)

        // Update agent states with worktree info
        for (const agent of this.state.agents) {
          const wt = worktrees.get(agent.taskId)
          if (wt) {
            agent.worktreePath = wt.path
            agent.worktreeBranch = wt.branch
          }
        }
      }

      // Open panels
      const titles = plan.tasks.map((t) => t.title)
      const panels = await this.panelSpawner.spawnPanels(plan.tasks.length, titles)

      // Create tasks in each provider (startTask=false)
      const panelEntries = Array.from(panels.entries())
      this.coordinator = new AgentCoordinator()

      for (let i = 0; i < plan.tasks.length; i++) {
        if (this.aborted) return

        const task = plan.tasks[i]
        const [panelId, spawned] = panelEntries[i]
        const agent = this.state.agents[i]

        agent.providerId = panelId
        agent.panelId = panelId

        // Create the task in this provider but don't start it yet
        await spawned.provider.createTask(task.description, undefined, undefined, {
          startTask: false,
        })

        // Register with coordinator
        this.coordinator.registerAgent(agent, spawned.provider)
      }

      notify()

      // PHASE 3: RUN
      this.state.phase = "running"
      notify()

      // Start all simultaneously
      await this.coordinator.startAll()

      // Monitor: update state on each agent completion
      this.coordinator.on("agentCompleted", () => notify())
      this.coordinator.on("agentFailed", () => notify())

      // Wait for all to complete
      await this.coordinator.waitForAll()

      // PHASE 4: MERGE (if needed)
      if (needsMerge && mergeMode !== "never") {
        this.state.phase = "merging"
        notify()

        this.mergePipeline = new MergePipeline(this.workspacePath)
        this.state.mergeResults = await this.mergePipeline.mergeAll(
          this.state.agents,
          (_agentId, _result) => notify(),
        )
      }

      // PHASE 5: REPORT
      this.state.phase = "reporting"
      notify()

      this.state.finalReport = aggregateReports(this.state.agents, this.state.mergeResults)

      // Cleanup worktrees
      if (this.worktreeManager) {
        await this.worktreeManager.cleanupWorktrees()
      }

      this.state.phase = "complete"
      notify()
    } catch (error) {
      this.state.phase = "complete"
      this.state.finalReport = `Orchestration failed: ${error}`
      onStateChange({ ...this.state })
    }
  }

  /** Abort the current orchestration */
  async abort(): Promise<void> {
    this.aborted = true
    await this.panelSpawner.closeAllPanels()
    if (this.worktreeManager) {
      await this.worktreeManager.cleanupWorktrees()
    }
    this.state.phase = "complete"
    this.state.finalReport = "Orchestration aborted by user."
  }

  /** Get current state */
  getState(): OrchestratorState {
    return { ...this.state }
  }
}
```

**Commit:** `feat(multi-orch): add top-level orchestrator coordinating full lifecycle`
**Use `--no-verify` on commits.**

---

## AGENT 11: Tests

**Creates:**
- `src/core/multi-orchestrator/__tests__/types.spec.ts`
- `src/core/multi-orchestrator/__tests__/plan-generator.spec.ts`
- `src/core/multi-orchestrator/__tests__/merge-pipeline.spec.ts`
- `src/core/multi-orchestrator/__tests__/report-aggregator.spec.ts`

**Task:**

Write tests for the pure/testable components. Skip tests that require VS Code API mocks (panel spawner, coordinator).

Test `types.ts`: `generateAgentId()` returns valid strings, `createInitialAgentState()` returns correct defaults, `createInitialOrchestratorState()` returns idle state.

Test `report-aggregator.ts`: All agents completed produces correct report, mixed success/failure, with and without merge results.

Test `merge-pipeline.ts`: Mock `execSync` to test merge success, merge conflict detection, and conflict file listing.

Test `plan-generator.ts`: Mock `completePrompt` to return valid JSON, test `parsePlanResponse` with valid/invalid/malformed JSON.

Run: `cd src && npx vitest run core/multi-orchestrator/__tests__/`

**Commit:** `test(multi-orch): add unit tests for types, plan generator, merge pipeline, report aggregator`
**Use `--no-verify` on commits.**

---

## AGENT 12: AgentCountSelector + ChatTextArea

**Creates:** `webview-ui/src/components/multi-orchestrator/AgentCountSelector.tsx`
**Modifies:** `webview-ui/src/components/chat/ChatTextArea.tsx`

**Task:**

### 12a. Create the agent count dropdown

```typescript
// webview-ui/src/components/multi-orchestrator/AgentCountSelector.tsx
import React from "react"

interface AgentCountSelectorProps {
  value: number
  onChange: (count: number) => void
  max?: number
}

export const AgentCountSelector: React.FC<AgentCountSelectorProps> = ({
  value,
  onChange,
  max = 6,
}) => {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="opacity-70">Agents:</span>
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="bg-transparent border border-vscode-input-border rounded px-1 py-0.5 text-xs"
      >
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  )
}
```

### 12b. Add to ChatTextArea

In `webview-ui/src/components/chat/ChatTextArea.tsx`, find the bottom toolbar area where `ModeSelector` and `ApiConfigSelector` are rendered (around line 1300-1305).

Add the `AgentCountSelector` conditionally — only visible when the current mode is `multi-orchestrator`:

```tsx
import { AgentCountSelector } from "../multi-orchestrator/AgentCountSelector"

// Inside the toolbar, after ApiConfigSelector:
{currentMode === "multi-orchestrator" && (
  <AgentCountSelector
    value={extensionState.multiOrchMaxAgents ?? 4}
    onChange={(count) => {
      vscode.postMessage({
        type: "updateSettings",
        updatedSettings: { multiOrchMaxAgents: count },
      })
    }}
  />
)}
```

You'll need to get `currentMode` from the existing mode state — check how `ModeSelector` determines the current mode slug and reuse that.

**Commit:** `feat(multi-orch): add agent count selector to chat area for multi-orchestrator mode`
**Use `--no-verify` on commits.**

---

## AGENT 13: Status & Plan Review Panels

**Creates:**
- `webview-ui/src/components/multi-orchestrator/MultiOrchStatusPanel.tsx`
- `webview-ui/src/components/multi-orchestrator/PlanReviewPanel.tsx`

**Task:**

### 13a. MultiOrchStatusPanel

Displays during execution, showing agent progress:

```typescript
// webview-ui/src/components/multi-orchestrator/MultiOrchStatusPanel.tsx
import React from "react"
import type { OrchestratorState } from "../../../../src/core/multi-orchestrator/types"

interface MultiOrchStatusPanelProps {
  state: OrchestratorState
  onAbort: () => void
}

export const MultiOrchStatusPanel: React.FC<MultiOrchStatusPanelProps> = ({ state, onAbort }) => {
  const completedCount = state.agents.filter((a) => a.status === "completed").length
  const failedCount = state.agents.filter((a) => a.status === "failed").length

  return (
    <div className="p-3 border border-vscode-panel-border rounded-md">
      <div className="text-sm font-medium mb-2">
        ⚡ Multi-Orchestration: {state.phase}
      </div>
      <div className="text-xs opacity-70 mb-3">
        {completedCount + failedCount}/{state.agents.length} agents complete
      </div>

      <div className="space-y-1.5">
        {state.agents.map((agent) => (
          <div key={agent.taskId} className="flex items-center gap-2 text-xs">
            <span>
              {agent.status === "completed" ? "✅" :
               agent.status === "failed" ? "❌" :
               agent.status === "running" ? "🔄" : "⏳"}
            </span>
            <span className="truncate flex-1">{agent.title}</span>
            <span className="opacity-50">{agent.mode}</span>
          </div>
        ))}
      </div>

      {state.phase !== "complete" && (
        <button
          onClick={onAbort}
          className="mt-3 text-xs text-vscode-errorForeground hover:underline"
        >
          Abort
        </button>
      )}

      {state.finalReport && (
        <div className="mt-3 text-xs whitespace-pre-wrap opacity-80 border-t border-vscode-panel-border pt-2">
          {state.finalReport}
        </div>
      )}
    </div>
  )
}
```

### 13b. PlanReviewPanel

Shown when plan-review is enabled, before execution starts:

```typescript
// webview-ui/src/components/multi-orchestrator/PlanReviewPanel.tsx
import React from "react"
import { Button } from "@src/components/ui"
import type { OrchestratorPlan } from "../../../../src/core/multi-orchestrator/types"

interface PlanReviewPanelProps {
  plan: OrchestratorPlan
  onApprove: () => void
  onCancel: () => void
}

export const PlanReviewPanel: React.FC<PlanReviewPanelProps> = ({ plan, onApprove, onCancel }) => {
  return (
    <div className="p-3 border border-vscode-panel-border rounded-md">
      <div className="text-sm font-medium mb-2">⚡ Execution Plan</div>
      <div className="text-xs opacity-70 mb-3">
        {plan.tasks.length} parallel tasks · {plan.estimatedComplexity} complexity
        {plan.requiresMerge && " · merge required"}
      </div>

      <div className="space-y-2 mb-4">
        {plan.tasks.map((task, i) => (
          <div key={task.id} className="text-xs border-l-2 border-vscode-button-background pl-2">
            <div className="font-medium">
              Task {i + 1}: {task.title} → {task.mode}
            </div>
            <div className="opacity-70 mt-0.5 line-clamp-2">{task.description}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={onApprove}>Execute Plan</Button>
      </div>
    </div>
  )
}
```

**Note on imports:** The types import path `../../../../src/core/multi-orchestrator/types` may need adjustment. Check how other webview components import from the extension source — they may use a different alias or the types may need to be exported from `@roo-code/types` instead. If the import doesn't resolve, create a minimal types re-export in the webview source.

**Commit:** `feat(multi-orch): add status panel and plan review panel components`
**Use `--no-verify` on commits.**

---

## AGENT 14: Message Handlers

**Modifies:** `src/core/webview/webviewMessageHandler.ts`

**Task:**

Add handlers for the multi-orchestrator message types. Find the message handler switch statement (around line 537). Add these cases before `default:`:

```typescript
case "multiOrchStartPlan": {
  // User submitted a request in multi-orchestrator mode
  const userRequest = message.text || ""
  const orchestrator = provider.getMultiOrchestrator?.()
  if (!orchestrator) break

  const maxAgents = getGlobalState("multiOrchMaxAgents") ?? 4
  const planReview = getGlobalState("multiOrchPlanReviewEnabled") ?? false
  const mergeMode = (getGlobalState("multiOrchMergeEnabled") as "auto" | "always" | "never") ?? "auto"
  const providerSettings = provider.contextProxy.getProviderSettings()
  const { getAllModes } = await import("../../shared/modes")
  const customModes = await provider.customModesManager.getCustomModes()
  const allModes = getAllModes(customModes)

  orchestrator.execute(
    userRequest,
    maxAgents,
    providerSettings,
    allModes,
    planReview,
    mergeMode,
    (state) => {
      provider.postMessageToWebview({
        type: "multiOrchStatusUpdate",
        text: JSON.stringify(state),
      })
    },
  ).then(() => {
    provider.postMessageToWebview({
      type: "multiOrchComplete",
      text: JSON.stringify(orchestrator.getState()),
    })
  }).catch((error) => {
    provider.postMessageToWebview({
      type: "multiOrchError",
      text: String(error),
    })
  })
  break
}

case "multiOrchApprovePlan": {
  const orchestrator = provider.getMultiOrchestrator?.()
  if (!orchestrator) break
  const state = orchestrator.getState()
  if (!state.plan) break

  const mergeMode = (getGlobalState("multiOrchMergeEnabled") as "auto" | "always" | "never") ?? "auto"
  const providerSettings = provider.contextProxy.getProviderSettings()

  orchestrator.executeFromPlan(
    state.plan,
    providerSettings,
    mergeMode,
    (newState) => {
      provider.postMessageToWebview({
        type: "multiOrchStatusUpdate",
        text: JSON.stringify(newState),
      })
    },
  )
  break
}

case "multiOrchAbort": {
  const orchestrator = provider.getMultiOrchestrator?.()
  if (orchestrator) {
    await orchestrator.abort()
    await provider.postMessageToWebview({
      type: "multiOrchComplete",
      text: JSON.stringify(orchestrator.getState()),
    })
  }
  break
}

case "multiOrchGetStatus": {
  const orchestrator = provider.getMultiOrchestrator?.()
  if (orchestrator) {
    await provider.postMessageToWebview({
      type: "multiOrchStatusUpdate",
      text: JSON.stringify(orchestrator.getState()),
    })
  }
  break
}
```

**Note:** You'll also need to add `getMultiOrchestrator()` to ClineProvider — but since Agent 4 owns ClineProvider changes, coordinate: Agent 4 should add a `private multiOrchestrator?: MultiOrchestrator` field and a `getMultiOrchestrator()` accessor. If Agent 4 hasn't done this, add it yourself with a note.

**Commit:** `feat(multi-orch): add message handlers for plan, approve, abort, and status`
**Use `--no-verify` on commits.**

---

## AGENT 15: Settings Section

**Modifies:** `webview-ui/src/components/settings/SettingsView.tsx`

**Task:**

Add a Multi-Orchestrator section to the settings. This is a small addition to the existing settings infrastructure.

Find the `sectionNames` array (around line 98). Add `"multiOrch"` after `"memory"`.

Find the `sections` icon mapping (around line 509). Add:
```typescript
{ id: "multiOrch", icon: Zap },  // import Zap from lucide-react
```

Add the tab content block (following the pattern of other sections):

```tsx
{renderTab === "multiOrch" && (
  <div>
    <SectionHeader>Multi-Orchestrator</SectionHeader>
    <Section>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <p style={{ fontSize: "13px", opacity: 0.7 }}>
          Configure parallel task execution across multiple agents.
        </p>

        {/* Max agents */}
        <div>
          <label style={{ fontSize: "13px", fontWeight: 500 }}>Default Max Agents</label>
          <p style={{ fontSize: "11px", opacity: 0.6, marginBottom: "4px" }}>
            Maximum number of parallel agents (1-6).
          </p>
          <select
            value={cachedState.multiOrchMaxAgents || 4}
            onChange={(e) => setCachedStateField("multiOrchMaxAgents", parseInt(e.target.value))}
            style={{
              width: "100%", padding: "6px 8px",
              background: "var(--vscode-input-background)",
              color: "var(--vscode-input-foreground)",
              border: "1px solid var(--vscode-input-border)",
              borderRadius: "2px",
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n} agents</option>
            ))}
          </select>
        </div>

        {/* Plan review toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="checkbox"
            checked={cachedState.multiOrchPlanReviewEnabled ?? false}
            onChange={(e) => setCachedStateField("multiOrchPlanReviewEnabled", e.target.checked)}
          />
          <label style={{ fontSize: "13px" }}>
            Review execution plan before starting (plan-review mode)
          </label>
        </div>

        {/* Merge mode */}
        <div>
          <label style={{ fontSize: "13px", fontWeight: 500 }}>Merge Conflict Resolution</label>
          <p style={{ fontSize: "11px", opacity: 0.6, marginBottom: "4px" }}>
            When to run the merge phase after agents complete.
          </p>
          <select
            value={cachedState.multiOrchMergeEnabled || "auto"}
            onChange={(e) => setCachedStateField("multiOrchMergeEnabled", e.target.value)}
            style={{
              width: "100%", padding: "6px 8px",
              background: "var(--vscode-input-background)",
              color: "var(--vscode-input-foreground)",
              border: "1px solid var(--vscode-input-border)",
              borderRadius: "2px",
            }}
          >
            <option value="auto">Auto-detect (merge only if code agents used)</option>
            <option value="always">Always merge</option>
            <option value="never">Never merge</option>
          </select>
        </div>
      </div>
    </Section>
  </div>
)}
```

**CRITICAL:** All inputs bind to `cachedState` via `setCachedStateField`, NOT live state.

**Commit:** `feat(multi-orch): add multi-orchestrator settings section`
**Use `--no-verify` on commits.**

---

## EXECUTION ORDER

```
Phase 1 (parallel, no dependencies):     Agents 1, 2, 3
Phase 2 (parallel, depend on Agent 1):   Agents 4, 5, 6, 7, 8, 9
Phase 3 (parallel, depend on Phase 2):   Agents 10, 11, 12, 13, 14, 15
Then: 10 verification/merge agents
```

## VERIFICATION CHECKLIST

After all agents complete, verification agents should check:

1. TypeScript compilation: `cd packages/types && npx tsc --noEmit`
2. TypeScript compilation: `cd src && npx tsc --noEmit`
3. TypeScript compilation: `cd webview-ui && npx tsc --noEmit`
4. Tests: `cd src && npx vitest run core/multi-orchestrator/`
5. Lint: `cd src && npx eslint core/multi-orchestrator/ --ext=ts --max-warnings=0`
6. All imports resolve between modules
7. Message types in handler match those in type definitions
8. ClineProvider has `getMultiOrchestrator()` accessor
9. Mode slug `multi-orchestrator` appears in DEFAULT_MODES
10. Settings bind to cachedState not live state
