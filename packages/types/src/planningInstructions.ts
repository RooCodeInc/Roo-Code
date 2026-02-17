// ====================
// PLANNING INSTRUCTIONS
// ====================

export const PLANNING_INSTRUCTIONS = `
## Planning File Creation Protocol

**When to Create Planning Files:**
- For multi-phase tasks with dependencies between components
- When coordinating work across multiple modes (salesforce-agent, code)
- For complex scenarios requiring sequential execution

**Planning File Location:** \`.siid-code/planning/[descriptive-name]-plan.md\`

**IMPORTANT: Use MEANINGFUL names based on what the task does, NOT timestamps!**
- Good: \`invoice-object-trigger-plan.md\`, \`user-registration-flow-plan.md\`, \`case-automation-plan.md\`
- Bad: \`task-20260128-1030.md\`, \`task-1.md\`, \`plan.md\`

**Why meaningful names?**
- Easier for AI to find the correct planning file later
- Avoids confusion when multiple subtasks create planning files
- Self-documenting for future reference

**Note:** Planning files are automatically shown in environment_details and will be auto-deleted when the task completes via attempt_completion.

**Planning File Template:**
\`\`\`markdown
# Orchestration Task Plan
**Created:** [timestamp]
**Status:** 🔄 In Progress

---

## Original Request
"[Full user request here]"

---

## Request Analysis

**Components Identified:**
1. [Component 1] → [Which mode]
2. [Component 2] → [Which mode]
3. [Component 3] → [Which mode]

---

## Phase Plan

**Phase 1/N: [Description] ([mode-name])**
- **Deliverables:** [What will be created]
- **Dependencies:** [What must be done first]
- **Estimated complexity:** [Simple | Medium | Complex]
- **Files Changed:**
  - \`[exact-file-path]\` — [created | modified | deleted]

**Phase 2/N: [Description] ([mode-name])**
- **Deliverables:** [What will be created]
- **Dependencies:** [What must be done first]
- **Estimated complexity:** [Simple | Medium | Complex]
- **Files Changed:**
  - \`[exact-file-path]\` — [created | modified | deleted]

**Phase N/N: Deploy**
- **Deliverables:** Deploy ONLY the specific changed files listed above to the target environment
- **Dependencies:** All previous phases completed and validated
- **Estimated complexity:** [Simple | Medium | Complex]
- **Files to Deploy:** (collected from all phases above)
  - \`[exact-file-path]\`

---

## Execution Log

**Phase 1: [Status]**
- Started: [timestamp]
- Completed: [timestamp]
- Files Modified:
  - \`[file-path]\` — [created | modified | deleted]
  - \`[file-path]\` — [created | modified | deleted]
- Notes: [any issues or important details]

**Phase 2: [Status]**
- Started: [timestamp]
- Completed: [timestamp]
- Files Modified:
  - \`[file-path]\` — [created | modified | deleted]
  - \`[file-path]\` — [created | modified | deleted]
- Notes: [any issues or important details]

**Deploy Phase: [Status]**
- Started: [timestamp]
- Completed: [timestamp]
- Environment: [target environment]
- **IMPORTANT: Deploy ONLY the specific files changed — NEVER deploy entire folders (e.g., default/, classes/, lwc/, triggers/). Use the exact file paths collected from previous phases.**
- Files & Deployment Status:
  - \`[exact-file-path]\` — [local | dry-run | deploying | deployed | failed]
  - \`[exact-file-path]\` — [local | dry-run | deploying | deployed | failed]
- Notes: [deployment details, any issues]

---

## Final Summary
[Summary of all work completed and any remaining tasks]

### Modified Files & Deployment Status
| File | Status | Deployment |
|------|--------|------------|
| \`[file-path]\` | created/modified/deleted | local/dry-run/deploying/deployed/failed |
\`\`\`

**Update Protocol:**
- Update the execution log section after EACH phase completion using write_to_file tool
- Mark phases as complete and note any issues
- Include final summary when all phases are done
`

// ====================
// PLANNING WORKFLOW STEPS
// ====================

export const PLANNING_WORKFLOW_STEPS = `
### Planning Workflow

1. **Create Planning File** at \`.siid-code/planning/[descriptive-name]-plan.md\`
   - Use meaningful names (e.g., \`invoice-trigger-plan.md\`)
   - Include: request, components, phases, execution log

2. **Create/Update Todo List** with phases:
   - [ ] pending, [-] in_progress, [x] completed
   - ONE task in_progress at a time

3. **Execute & Validate** each phase before proceeding

4. **Deploy** only the specific changed files to the target environment as the final phase
   - NEVER deploy entire folders (e.g., \`default/\`, \`classes/\`, \`lwc/\`, \`triggers/\`)
   - Collect exact file paths from each phase's "Files Changed" list
   - Deploy only those individual files
`
