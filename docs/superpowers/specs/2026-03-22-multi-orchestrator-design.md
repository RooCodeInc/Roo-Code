# Multi-Orchestrator Mode — Design Spec

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
| Merge phase | Auto-detect (skip if no code agents) + manual override in mode settings |

## Architecture

```
User Request
    │
    ▼
┌────────────────────────────────────────────────────────┐
│  MULTI-ORCHESTRATOR (sidebar ClineProvider)             │
│                                                        │
│  1. PLAN PHASE                                         │
│     └─ Decompose request into N tasks                  │
│     └─ Assign mode + task description to each          │
│     └─ Present plan (if plan-review mode enabled)      │
│     └─ User approves or auto-proceeds                  │
│                                                        │
│  2. SPAWN PHASE                                        │
│     └─ Create N git worktrees (via WorktreeService)    │
│     └─ Open N editor tab panels (via openClineInNewTab)│
│     └─ Inject task into each provider (startTask=false)│
│     └─ Wait until ALL tasks are written/ready          │
│     └─ Start ALL tasks simultaneously                  │
│                                                        │
│  3. MONITOR PHASE                                      │
│     └─ Listen for TaskCompleted events from each       │
│     └─ Update status display in orchestrator panel     │
│     └─ Wait until ALL complete                         │
│                                                        │
│  4. MERGE PHASE (if code agents detected OR forced on) │
│     └─ Sequentially merge worktree branches into main  │
│     └─ For each: merge, detect conflicts, resolve      │
│     └─ Each agent gets: other agents' reports + diffs  │
│                                                        │
│  5. REPORT PHASE                                       │
│     └─ Collect completion reports from all agents      │
│     └─ Present unified summary to user                 │
│     └─ Clean up worktrees                              │
└────────────────────────────────────────────────────────┘
```

---

## INTERFACE CONTRACTS

These are the shared boundaries. Every agent MUST use these exact signatures.

### Types (Agent 1 creates these, all others import)

```typescript
// src/core/multi-orchestrator/types.ts

export interface OrchestratorPlan {
  tasks: PlannedTask[]
  requiresMerge: boolean
  estimatedComplexity: "low" | "medium" | "high"
}

export interface PlannedTask {
  id: string                    // UUID
  mode: string                  // mode slug (e.g., "code", "architect", "ask")
  title: string                 // short description
  description: string           // full task prompt to give the agent
  assignedFiles?: string[]      // files this agent is expected to touch (for separation)
  priority: number              // execution order hint (all start together, but for display)
}

export type AgentStatus =
  | "pending"        // task written but not started
  | "running"        // actively executing
  | "completed"      // finished successfully
  | "failed"         // errored out
  | "merging"        // in merge conflict check phase

export interface AgentState {
  taskId: string               // PlannedTask.id
  providerId: string           // ClineProvider instance identifier
  panelId: string              // WebviewPanel identifier
  worktreePath: string | null  // git worktree path (null if non-code)
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

### New Message Types (Agent 2 adds these)

```typescript
// In packages/types/src/vscode-extension-host.ts

// WebviewMessage additions:
| "multiOrchStartPlan"         // user submits request in multi-orch mode
| "multiOrchApprovePlan"       // user approves plan (in plan-review mode)
| "multiOrchAbort"             // user cancels
| "multiOrchGetStatus"         // webview requests current status

// ExtensionMessage additions:
| "multiOrchPlanReady"         // orchestrator has a plan for review
| "multiOrchStatusUpdate"      // status changed (agent completed, phase changed, etc.)
| "multiOrchComplete"          // all phases done, final report ready
| "multiOrchError"             // something went wrong
```

### New Global Settings (Agent 2 adds these)

```typescript
// In packages/types/src/global-settings.ts (add to globalSettingsSchema)
multiOrchMaxAgents: z.number().min(1).max(6).optional(),        // default 4
multiOrchPlanReviewEnabled: z.boolean().optional(),              // default false (autonomous)
multiOrchMergeEnabled: z.boolean().optional(),                   // default auto-detect, true = always merge
```

### Multi-Orchestrator Mode Definition (Agent 3 adds this)

```typescript
// Added to DEFAULT_MODES in packages/types/src/mode.ts
{
  slug: "multi-orchestrator",
  name: "⚡ Multi-Orchestrator",
  roleDefinition: "You are Roo, a parallel workflow orchestrator that decomposes complex tasks into multiple independent subtasks and dispatches them to specialized modes running simultaneously. You analyze the user's request, identify separable concerns, assign each to the most appropriate mode, and coordinate their parallel execution with git worktree isolation.",
  whenToUse: "Use for complex tasks that can be parallelized across multiple modes — e.g., 'build an auth system' could split into architecture design, backend implementation, frontend implementation, and tests running simultaneously.",
  description: "Parallel task execution across multiple agents",
  groups: [],  // uses only ALWAYS_AVAILABLE_TOOLS + new multi-orch tools
  customInstructions: `Your workflow:
1. Analyze the user's request and decompose into 1-${MULTI_ORCHESTRATOR_CONSTANTS.MAX_AGENTS} independent tasks
2. Assign each task to the most appropriate mode (code, architect, ask, debug)
3. Maximize separation — each agent should touch different files/areas
4. Present the plan (if plan-review is enabled) or proceed automatically
5. Monitor execution and collect reports
6. Present a unified summary

CRITICAL: When decomposing tasks, ensure agents work on DIFFERENT files to minimize merge conflicts. Prefer splitting by module/feature boundary.`
}
```

---

## FILE OWNERSHIP MAP

Every file is assigned to exactly ONE agent. No overlaps.

### New Files

| File | Owner Agent | Purpose |
|---|---|---|
| `src/core/multi-orchestrator/types.ts` | Agent 1 | All shared types and constants |
| `src/core/multi-orchestrator/panel-spawner.ts` | Agent 4 | Create/manage N ClineProvider tab panels |
| `src/core/multi-orchestrator/worktree-manager.ts` | Agent 5 | Create/cleanup worktrees for each agent |
| `src/core/multi-orchestrator/plan-generator.ts` | Agent 6 | LLM-based task decomposition |
| `src/core/multi-orchestrator/agent-coordinator.ts` | Agent 7 | Lifecycle management, event listening, status tracking |
| `src/core/multi-orchestrator/merge-pipeline.ts` | Agent 8 | Sequential branch merging after completion |
| `src/core/multi-orchestrator/report-aggregator.ts` | Agent 9 | Collect and format final report |
| `src/core/multi-orchestrator/orchestrator.ts` | Agent 10 | Top-level coordinator tying all components together |
| `src/core/multi-orchestrator/__tests__/types.spec.ts` | Agent 11 | Type validation tests |
| `src/core/multi-orchestrator/__tests__/panel-spawner.spec.ts` | Agent 11 | Panel spawner tests |
| `src/core/multi-orchestrator/__tests__/worktree-manager.spec.ts` | Agent 11 | Worktree manager tests |
| `src/core/multi-orchestrator/__tests__/plan-generator.spec.ts` | Agent 11 | Plan generator tests |
| `src/core/multi-orchestrator/__tests__/merge-pipeline.spec.ts` | Agent 11 | Merge pipeline tests |
| `webview-ui/src/components/multi-orchestrator/AgentCountSelector.tsx` | Agent 12 | Agent count dropdown for chat area |
| `webview-ui/src/components/multi-orchestrator/MultiOrchStatusPanel.tsx` | Agent 13 | Status display showing all agents' progress |
| `webview-ui/src/components/multi-orchestrator/PlanReviewPanel.tsx` | Agent 13 | Plan approval UI for plan-review mode |

### Modified Files

| File | Owner Agent | Changes |
|---|---|---|
| `packages/types/src/vscode-extension-host.ts` | Agent 2 | Add message types |
| `packages/types/src/global-settings.ts` | Agent 2 | Add settings fields |
| `packages/types/src/mode.ts` | Agent 3 | Add multi-orchestrator to DEFAULT_MODES |
| `src/shared/modes.ts` | Agent 3 | Ensure new mode is exported/accessible |
| `src/core/webview/ClineProvider.ts` | Agent 4 | Add static accessor for activeInstances, add multi-orch initialization |
| `src/core/webview/webviewMessageHandler.ts` | Agent 14 | Add multi-orch message handlers |
| `webview-ui/src/components/chat/ChatTextArea.tsx` | Agent 12 | Show AgentCountSelector when multi-orch mode is active |
| `webview-ui/src/components/settings/SettingsView.tsx` | Agent 15 | Add multi-orch settings (merge toggle, plan-review default) |

---

## COMPONENT SPECIFICATIONS

### Component 1: Panel Spawner (Agent 4)

**File:** `src/core/multi-orchestrator/panel-spawner.ts`

Manages the lifecycle of N ClineProvider instances in editor tab panels.

```typescript
export class PanelSpawner {
  private panels: Map<string, { provider: ClineProvider; panel: vscode.WebviewPanel }> = new Map()

  /** Spawn N panels across ViewColumns, return provider references */
  async spawnAgentPanels(
    count: number,
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel,
    titles: string[],
  ): Promise<Map<string, ClineProvider>>

  /** Close a specific panel */
  async closePanel(id: string): Promise<void>

  /** Close all panels */
  async closeAllPanels(): Promise<void>

  /** Get all active providers */
  getProviders(): Map<string, ClineProvider>
}
```

**Key implementation detail:** Uses the `openClineInNewTab` pattern but creates panels at `ViewColumn.One` through `ViewColumn.Six` (not incrementing from existing editors). Titles are set to the task title (e.g., "Agent 1: Auth Module").

### Component 2: Worktree Manager (Agent 5)

**File:** `src/core/multi-orchestrator/worktree-manager.ts`

Manages git worktree lifecycle for each agent.

```typescript
export class MultiWorktreeManager {
  constructor(private workspacePath: string) {}

  /** Create N worktrees from current HEAD, each on its own branch */
  async createWorktrees(
    agentIds: string[],
  ): Promise<Map<string, { path: string; branch: string }>>

  /** Delete all orchestrator worktrees */
  async cleanupWorktrees(agentIds: string[]): Promise<void>

  /** Get the branch name for an agent */
  getBranchName(agentId: string): string
  // Returns: `multi-orch/${agentId}`
}
```

**Uses:** Existing `WorktreeService` from `packages/core/src/worktree/worktree-service.ts`.

### Component 3: Plan Generator (Agent 6)

**File:** `src/core/multi-orchestrator/plan-generator.ts`

Uses LLM to decompose user request into parallel tasks.

```typescript
export async function generatePlan(
  userRequest: string,
  availableModes: ModeConfig[],
  maxAgents: number,
  providerSettings: ProviderSettings,
): Promise<OrchestratorPlan>
```

**System prompt for plan generation:** Analyzes the request, identifies separable concerns, assigns modes, estimates file boundaries, determines if merge is needed.

### Component 4: Agent Coordinator (Agent 7)

**File:** `src/core/multi-orchestrator/agent-coordinator.ts`

Tracks lifecycle of all spawned agents.

```typescript
export class AgentCoordinator extends EventEmitter {
  private agents: Map<string, AgentState> = new Map()

  /** Register an agent and start listening for its events */
  registerAgent(agent: AgentState, provider: ClineProvider): void

  /** Start all registered agents simultaneously */
  async startAll(): Promise<void>

  /** Check if all agents have completed */
  allComplete(): boolean

  /** Get current state of all agents */
  getStates(): AgentState[]

  /** Wait for all agents to complete */
  async waitForAll(): Promise<void>

  // Events emitted:
  // "agentCompleted" → (agentTaskId: string, report: string)
  // "allCompleted" → ()
  // "agentFailed" → (agentTaskId: string, error: string)
}
```

**Key:** Listens for `TaskCompleted` events on each ClineProvider instance. Updates `AgentState.status` accordingly.

### Component 5: Merge Pipeline (Agent 8)

**File:** `src/core/multi-orchestrator/merge-pipeline.ts`

Sequentially merges worktree branches into the main branch.

```typescript
export class MergePipeline {
  constructor(private workspacePath: string) {}

  /** Merge all agent branches sequentially into the current branch */
  async mergeAll(
    agents: AgentState[],
    onProgress: (agentId: string, result: MergeResult) => void,
  ): Promise<MergeResult[]>

  /** Merge a single agent's branch */
  private async mergeBranch(branch: string): Promise<MergeResult>
}
```

**Strategy:** For each agent (in priority order):
1. `git merge --no-ff <branch>`
2. If conflicts: attempt auto-resolution, log conflict count
3. Record files changed, conflicts found/resolved

### Component 6: Report Aggregator (Agent 9)

**File:** `src/core/multi-orchestrator/report-aggregator.ts`

```typescript
export function aggregateReports(
  agents: AgentState[],
  mergeResults: MergeResult[],
): string
```

Returns a formatted markdown report showing what each agent did, merge results, and overall summary.

### Component 7: Top-Level Orchestrator (Agent 10)

**File:** `src/core/multi-orchestrator/orchestrator.ts`

The conductor that ties all phases together.

```typescript
export class MultiOrchestrator {
  private state: OrchestratorState
  private panelSpawner: PanelSpawner
  private worktreeManager: MultiWorktreeManager
  private coordinator: AgentCoordinator
  private mergePipeline: MergePipeline

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.OutputChannel,
    private workspacePath: string,
  ) {}

  /** Full orchestration lifecycle */
  async execute(
    userRequest: string,
    maxAgents: number,
    providerSettings: ProviderSettings,
    planReviewEnabled: boolean,
    onStateChange: (state: OrchestratorState) => void,
  ): Promise<void>

  /** Abort the current orchestration */
  async abort(): Promise<void>

  /** Get current state */
  getState(): OrchestratorState
}
```

**Lifecycle:**
1. `state.phase = "planning"` → call `generatePlan()`
2. If `planReviewEnabled`: `state.phase = "planning"`, emit plan for review, wait for approval
3. `state.phase = "spawning"` → create worktrees, open panels, inject tasks (startTask=false)
4. `state.phase = "running"` → start all tasks simultaneously, monitor via coordinator
5. `state.phase = "merging"` → if `requiresMerge`, run merge pipeline
6. `state.phase = "reporting"` → aggregate reports
7. `state.phase = "complete"` → present final report, cleanup worktrees

---

## UI COMPONENTS

### AgentCountSelector (Agent 12)

Dropdown in ChatTextArea, only visible when multi-orchestrator mode is selected.

```
┌─────────────────────────────────────────────┐
│  [Chat input...]                            │
│  ⚡ Multi-Orchestrator │ Agents: [▼4] │ 📤  │
└─────────────────────────────────────────────┘
```

Reads `multiOrchMaxAgents` from extension state. Posts `updateSettings` on change.

### MultiOrchStatusPanel (Agent 13)

Displayed in the orchestrator's chat area during execution. Shows:

```
┌─────────────────────────────────────────────┐
│  ⚡ Multi-Orchestration in Progress          │
│                                             │
│  Phase: Running (3/5 agents complete)       │
│  ┌─────────────────────────────────────┐    │
│  │ ✅ Agent 1: Auth Module (code)      │    │
│  │ ✅ Agent 2: API Design (architect)  │    │
│  │ ✅ Agent 3: Unit Tests (code)       │    │
│  │ 🔄 Agent 4: Frontend (code)        │    │
│  │ 🔄 Agent 5: Documentation (ask)    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [Abort]                                    │
└─────────────────────────────────────────────┘
```

### PlanReviewPanel (Agent 13)

Shown when `planReviewEnabled = true`, before agents start:

```
┌─────────────────────────────────────────────┐
│  ⚡ Execution Plan                           │
│                                             │
│  Task 1: Auth Module → 💻 Code              │
│    "Implement JWT authentication..."        │
│  Task 2: API Design → 🏗 Architect          │
│    "Design the REST API endpoints..."       │
│  Task 3: Unit Tests → 💻 Code               │
│    "Write comprehensive test suite..."      │
│                                             │
│  [Cancel]              [Execute Plan]       │
└─────────────────────────────────────────────┘
```

---

## AGENT ASSIGNMENT FOR BLITZ

| Agent # | Responsibility | Files Owned | Dependencies |
|---|---|---|---|
| 1 | Types & constants | `multi-orchestrator/types.ts` | None |
| 2 | Message types + settings | `vscode-extension-host.ts`, `global-settings.ts` | None |
| 3 | Mode definition | `mode.ts`, `modes.ts` | None |
| 4 | Panel spawner | `panel-spawner.ts`, `ClineProvider.ts` (accessor only) | Agent 1 |
| 5 | Worktree manager | `worktree-manager.ts` | Agent 1 |
| 6 | Plan generator | `plan-generator.ts` | Agent 1 |
| 7 | Agent coordinator | `agent-coordinator.ts` | Agent 1 |
| 8 | Merge pipeline | `merge-pipeline.ts` | Agent 1 |
| 9 | Report aggregator | `report-aggregator.ts` | Agent 1 |
| 10 | Top-level orchestrator | `orchestrator.ts` | Agents 1, 4-9 |
| 11 | Tests (all components) | `__tests__/*.spec.ts` | Agents 1, 4-9 |
| 12 | AgentCountSelector + ChatTextArea | `AgentCountSelector.tsx`, `ChatTextArea.tsx` | Agent 2 |
| 13 | Status + Plan Review panels | `MultiOrchStatusPanel.tsx`, `PlanReviewPanel.tsx` | Agent 2 |
| 14 | Message handlers | `webviewMessageHandler.ts` | Agents 2, 10 |
| 15 | Settings section | `SettingsView.tsx` | Agent 2 |

### Execution Order

```
Phase 1 (parallel, no dependencies):
  Agents 1, 2, 3 — types, message types, mode definition

Phase 2 (parallel, depend on Agent 1):
  Agents 4, 5, 6, 7, 8, 9 — all core components

Phase 3 (parallel, depend on Phase 2):
  Agents 10, 11, 12, 13, 14, 15 — orchestrator, tests, UI, handlers

Then: 10 verification/merge agents
```

---

## SETTINGS

### Mode Settings (in ModesView for multi-orchestrator)
- Plan review toggle: autonomous vs plan-review (default: autonomous)

### Global Settings (in SettingsView)
- `multiOrchMaxAgents`: 1-6 (default: 4)
- `multiOrchMergeEnabled`: auto/always/never (default: auto)

### Chat Area (contextual, only in multi-orchestrator mode)
- Agent count dropdown: [1] [2] [3] [4] [5] [6]

---

## ERROR HANDLING

- If an agent fails: mark as `failed`, don't block others. Report failure to orchestrator.
- If merge has unresolvable conflicts: mark in MergeResult, include in report, let user resolve manually.
- If user aborts during execution: close all agent panels, cleanup worktrees.
- If extension crashes: worktrees persist on disk but are cleaned up on next orchestration start.
