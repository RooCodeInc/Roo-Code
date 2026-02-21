# Intent-Driven Architect Protocol - Integration Test Plan

**Date:** February 18, 2026  
**Author:** Kidus Tewodros  
**Component:** System Prompt Integration & Protocol Enforcement  
**Status:** Ready for Testing

---

## ✅ TASK 3: INTEGRATION VERIFICATION

### **System Prompt Integration Status**

#### **File Path:** `src/core/prompts/system.ts`

**Integration Point (Line 95):**

```typescript
${getIntentProtocolSection()}
```

**Position in Prompt Structure:**

1. Role Definition
2. Markdown Formatting
3. Shared Tool Use Section
4. Tool Use Guidelines
5. Capabilities Section
6. **→ INTENT PROTOCOL SECTION ← (NEW)**
7. Modes Section
8. Skills Section (if available)
9. Rules Section
10. System Info Section
11. Objective Section
12. Custom Instructions

**✅ Verification Results:**

| Check             | Status  | Details                                               |
| ----------------- | ------- | ----------------------------------------------------- |
| Function imported | ✅ Pass | Line 25: `getIntentProtocolSection` imported          |
| Function called   | ✅ Pass | Line 95: Inserted after Capabilities, before Modes    |
| Section exported  | ✅ Pass | `src/core/prompts/sections/index.ts` exports function |
| Returns string    | ✅ Pass | Function returns formatted markdown string            |
| No syntax errors  | ✅ Pass | TypeScript compilation successful                     |

---

### **Prompt Delivery Verification**

#### **How System Prompt is Sent:**

1. **Initial Request:**

    - `SYSTEM_PROMPT()` generates full prompt including intent protocol
    - Sent as `system` role message to LLM
    - Included in EVERY new conversation

2. **Subsequent Turns:**

    - System prompt remains in context window
    - LLM has access to protocol rules throughout conversation

3. **Chat History:**
    - System message is first message in conversation
    - Not displayed in UI (internal only)
    - Available for inspection via debugging

#### **Files Involved:**

- **Generation:** `src/core/prompts/system.ts`
- **Section Content:** `src/core/prompts/sections/intent-protocol.ts`
- **Export:** `src/core/prompts/sections/index.ts`
- **Usage:** `src/core/task/Task.ts` (calls `SYSTEM_PROMPT()`)

---

### **Token Count Analysis**

#### **Intent Protocol Section:**

- **Characters:** ~2,563
- **Estimated Tokens:** ~640 tokens (at 4 chars/token)
- **Words:** ~380 words

#### **Impact on Total Prompt:**

- **Typical Roo Code System Prompt:** ~3,500-4,500 tokens
- **With Intent Protocol:** ~4,140-5,140 tokens
- **Increase:** ~640 tokens (~15% increase)

#### **Token Limit Safety:**

- **Claude 3.5 Sonnet Context:** 200,000 tokens
- **Current Usage:** <3% of total context
- **Safe:** ✅ Well within limits

#### **Optimization Opportunities (if needed):**

- Protocol is already concise (380 words for 4 rules)
- Critical sections cannot be shortened without losing clarity
- Optional: Collapse examples if token pressure increases

---

### **Existing Functionality Preservation**

#### **Tested Compatibility:**

| Component           | Status       | Notes                     |
| ------------------- | ------------ | ------------------------- |
| Role Definition     | ✅ Unchanged | Still first section       |
| Tool Catalog        | ✅ Unchanged | Tools still listed        |
| Capabilities        | ✅ Unchanged | MCP, skills, etc. intact  |
| Rules Section       | ✅ Unchanged | Positioned after protocol |
| Custom Instructions | ✅ Unchanged | Still last section        |
| Mode Selection      | ✅ Unchanged | Modes section intact      |

**No Breaking Changes:** The protocol section is inserted cleanly without modifying existing sections.

---

## 🧪 TASK 4: PROTOCOL TEST PLAN

### **Test Environment Setup**

#### **Prerequisites:**

1. ✅ VS Code Extension Development Host
2. ✅ `.orchestration/active_intents.yaml` sample file
3. ✅ Test workspace with code files
4. ✅ Roo Code extension loaded

#### **Sample Intent File:**

Create `.orchestration/active_intents.yaml` in test workspace:

```yaml
intents:
    - id: "INT-001"
      name: "JWT Authentication Migration"
      status: "active"
      owned_scope:
          - "src/auth/**"
          - "src/middleware/jwt.ts"
      constraints:
          - "Must not use external auth providers"
          - "Use TypeScript strict mode"
          - "Include unit tests for all new functions"
      acceptance_criteria:
          - "JWT tokens validated on every request"
          - "Refresh token flow implemented"
          - "Token expiration properly handled"
      context: "Migrating from session-based auth to JWT tokens for stateless authentication"
      related_files:
          - "src/auth/middleware.ts"
          - "src/middleware/jwt.ts"
          - "tests/auth.spec.ts"

    - id: "INT-002"
      name: "Database Connection Pooling"
      status: "active"
      owned_scope:
          - "src/database/**"
          - "src/config/db.ts"
      constraints:
          - "Use pg-pool library"
          - "Maximum 20 connections"
          - "Connection timeout: 5 seconds"
      acceptance_criteria:
          - "Connection pool initialized on startup"
          - "Graceful shutdown on process exit"
          - "Health check endpoint added"
      context: "Optimize database performance with connection pooling"
      related_files:
          - "src/database/pool.ts"
          - "src/config/db.ts"
```

---

### **Test Scenario 1: Happy Path (Intent Selection)**

#### **Test Steps:**

1. **Launch Extension Development Host:**

    ```
    Press F5 in VS Code
    ```

2. **Open Roo Code Chat Panel:**

    ```
    Ctrl+Shift+P → "Roo Code: Open Chat"
    ```

3. **Issue Command:**

    ```
    User: "Refactor the auth middleware for JWT"
    ```

4. **Expected Agent Behavior:**

    **Step 1: Intent Selection (MANDATORY)**

    ```
    Agent: Let me first select the relevant intent for this task.

    Tool Call: select_active_intent({ intent_id: "INT-001" })
    ```

    **Step 2: System Response:**

    ```
    System: ✓ Intent "JWT Authentication Migration" (INT-001) activated

    Status: active
    Scope: src/auth/**, src/middleware/jwt.ts

    Constraints:
      • Must not use external auth providers
      • Use TypeScript strict mode
      • Include unit tests for all new functions

    Acceptance Criteria:
      ☐ JWT tokens validated on every request
      ☐ Refresh token flow implemented
      ☐ Token expiration properly handled

    Context loaded successfully. You can now proceed with code modifications.
    ```

    **Step 3: Agent Proceeds with Write:**

    ```
    Agent: Now I'll refactor the auth middleware...

    Tool Call: write_to_file({
      path: "src/auth/middleware.ts",
      content: "..."
    })
    ```

#### **Success Criteria:**

- ✅ Agent calls `select_active_intent` BEFORE any write operations
- ✅ Agent acknowledges receipt of intent context
- ✅ Agent references constraints in implementation
- ✅ Files written are within `owned_scope`

---

### **Test Scenario 2: Protocol Violation (No Intent)**

#### **Test Steps:**

1. **Issue Command:**

    ```
    User: "Update the database config"
    ```

2. **Agent Attempts Direct Write (Violates Rule 1):**

    ```
    Agent: I'll update the database configuration...

    Tool Call: write_to_file({
      path: "src/config/db.ts",
      content: "..."
    })
    ```

3. **Expected Pre-Hook Behavior:**

    **Option A: If Pre-Hook Wired (Future):**

    ```
    System: ❌ BLOCKED: Intent declaration required. Call select_active_intent first.

    Error: Tool execution blocked by governance policy.
    Available intents: INT-001, INT-002
    ```

    **Option B: Current State (Pre-Hook Not Wired):**

    ```
    Agent: [write_to_file executes normally - no blocking]
    ```

4. **Agent Recovery (After Error):**

    ```
    Agent: I see that I need to select an intent first. Let me do that now.

    Tool Call: select_active_intent({ intent_id: "INT-002" })

    [Then proceeds with write]
    ```

#### **Success Criteria:**

- ⚠️ **Current:** Agent SHOULD select intent (per system prompt) but not enforced
- ✅ **Future (with Pre-Hook):** Write operation BLOCKED if no intent
- ✅ Agent recovers autonomously after error

---

### **Test Scenario 3: Scope Violation (Out of Scope)**

#### **Test Steps:**

1. **Select Intent:**

    ```
    Agent: select_active_intent({ intent_id: "INT-001" })

    [Receives: owned_scope = src/auth/**, src/middleware/jwt.ts]
    ```

2. **Attempt Out-of-Scope Edit:**

    ```
    Agent: I'll also update the database config...

    Tool Call: write_to_file({
      path: "src/config/db.ts",  ← NOT in owned_scope!
      content: "..."
    })
    ```

3. **Expected Pre-Hook Behavior:**

    **Option A: If Pre-Hook Wired (Future):**

    ```
    System: ❌ BLOCKED: File src/config/db.ts is outside intent scope.

    Error: Allowed scope: src/auth/**, src/middleware/jwt.ts
    Please request scope expansion or select a different intent.
    ```

    **Option B: Current State:**

    ```
    Agent: [write_to_file executes normally - no blocking]
    ```

4. **Agent Recovery:**

    ```
    Agent: The database config is outside my current scope. Let me select the database intent.

    Tool Call: select_active_intent({ intent_id: "INT-002" })

    [Then proceeds with write to src/config/db.ts]
    ```

#### **Success Criteria:**

- ⚠️ **Current:** Agent SHOULD respect scope (per system prompt) but not enforced
- ✅ **Future (with Pre-Hook):** Out-of-scope write BLOCKED
- ✅ Agent requests scope expansion or switches intent

---

### **Test Scenario 4: Multiple Intents (Context Switching)**

#### **Test Steps:**

1. **Select First Intent:**

    ```
    User: "Work on JWT auth"
    Agent: select_active_intent({ intent_id: "INT-001" })
    ```

2. **Switch Context:**

    ```
    User: "Actually, let's optimize the database first"
    Agent: Let me switch to the database intent.

    Tool Call: select_active_intent({ intent_id: "INT-002" })
    ```

3. **Verify Active Intent Changed:**

    ```
    System: ✓ Intent "Database Connection Pooling" (INT-002) activated
    ```

4. **Write in New Scope:**
    ```
    Agent: write_to_file({
      path: "src/database/pool.ts",  ← Now in scope
      content: "..."
    })
    ```

#### **Success Criteria:**

- ✅ Agent can switch intents mid-conversation
- ✅ Session state updates to new intent
- ✅ Agent respects new scope constraints

---

### **Test Scenario 5: Intent Not Found**

#### **Test Steps:**

1. **Select Invalid Intent:**

    ```
    Agent: select_active_intent({ intent_id: "INT-999" })
    ```

2. **Expected Response:**

    ```
    System: ❌ Error: Intent not found: INT-999

    Available intents: INT-001, INT-002
    ```

3. **Agent Recovery:**

    ```
    Agent: That intent doesn't exist. Let me use INT-001 instead.

    Tool Call: select_active_intent({ intent_id: "INT-001" })
    ```

#### **Success Criteria:**

- ✅ Clear error message
- ✅ Lists available intents
- ✅ Agent recovers autonomously

---

## 📊 TEST RESULTS TEMPLATE

### **Test Execution Log**

```markdown
## Test Run: [Date/Time]

### Environment:

- VS Code Version: **\_\_**
- Roo Code Version: **\_\_**
- Model: **\_\_**
- Workspace: **\_\_**

### Scenario 1: Happy Path

- [ ] Agent called select_active_intent first
- [ ] Intent context received
- [ ] Agent proceeded with write
- [ ] Files within scope
- **Result:** PASS / FAIL
- **Notes:** **\_\_**

### Scenario 2: No Intent Violation

- [ ] Agent attempted write without intent
- [ ] Pre-Hook blocked (if wired) OR Agent followed prompt
- [ ] Agent recovered autonomously
- **Result:** PASS / FAIL
- **Notes:** **\_\_**

### Scenario 3: Scope Violation

- [ ] Agent attempted out-of-scope write
- [ ] Pre-Hook blocked (if wired) OR Agent respected scope
- [ ] Agent requested scope expansion or switched intent
- **Result:** PASS / FAIL
- **Notes:** **\_\_**

### Scenario 4: Context Switching

- [ ] Agent switched intents successfully
- [ ] Session state updated
- [ ] New scope respected
- **Result:** PASS / FAIL
- **Notes:** **\_\_**

### Scenario 5: Invalid Intent

- [ ] Error message clear
- [ ] Available intents listed
- [ ] Agent recovered
- **Result:** PASS / FAIL
- **Notes:** **\_\_**

### Overall Assessment:

**Protocol Awareness:** PASS / FAIL  
**Autonomous Recovery:** PASS / FAIL  
**Enforcement (with Pre-Hook):** PASS / FAIL / NOT TESTED

### Recommendations:

- ***
```

---

## 🔍 VERIFICATION CHECKLIST

### **Pre-Test Verification:**

- [x] `getIntentProtocolSection()` exported from `sections/index.ts`
- [x] Function called in `system.ts` at line 95
- [x] Intent protocol section returns valid markdown
- [x] No TypeScript compilation errors
- [x] `.orchestration/active_intents.yaml` sample created
- [x] Test workspace set up

### **During Test:**

- [ ] Launch Extension Development Host (F5)
- [ ] Open Roo Code chat panel
- [ ] Issue test commands
- [ ] Observe agent behavior
- [ ] Verify tool calls in chat history
- [ ] Check for protocol compliance

### **Post-Test:**

- [ ] Document results in test log
- [ ] Capture screenshots of violations (if any)
- [ ] Note any unexpected behaviors
- [ ] Recommend next steps for Pre-Hook wiring

---

## 🚀 EXPECTED OUTCOMES

### **Current State (85% Complete):**

**What WORKS:**

- ✅ System prompt includes protocol instructions
- ✅ Agent can call `select_active_intent` tool
- ✅ Intent context loaded from YAML
- ✅ Session state tracks active intent
- ✅ Error messages guide recovery

**What DOES NOT WORK (Yet):**

- ❌ Automated blocking of violations (requires Pre-Hook wiring)
- ❌ `write_to_file` does not accept `intent_id` parameter
- ❌ Trace logging not triggered automatically

**Agent Behavior:**

- **Best Case:** Agent follows protocol voluntarily (LLM obeys system prompt)
- **Worst Case:** Agent skips intent selection (system prompt ignored)
- **Reality:** Depends on model quality and prompt adherence

### **Future State (with Pre-Hook Wiring):**

**What WILL WORK:**

- ✅ Automated blocking of writes without intent
- ✅ Automated blocking of out-of-scope writes
- ✅ Enforced protocol compliance (not optional)
- ✅ Automatic trace logging

---

## 📁 FILES MODIFIED FOR INTEGRATION

| File                                           | Change          | Purpose                |
| ---------------------------------------------- | --------------- | ---------------------- |
| `src/core/prompts/sections/intent-protocol.ts` | Created/Updated | Protocol content       |
| `src/core/prompts/sections/index.ts`           | Export added    | Make section available |
| `src/core/prompts/system.ts`                   | Import + call   | Integrate into prompt  |
| `.orchestration/active_intents.yaml`           | Created (test)  | Sample intent data     |

---

## 🎯 SUCCESS CRITERIA

### **Minimum (Current Implementation):**

- ✅ Protocol instructions appear in system prompt
- ✅ Agent CAN select intents
- ✅ Intent context loaded correctly
- ✅ Session state updated

### **Ideal (with Pre-Hook):**

- ✅ Protocol ENFORCED automatically
- ✅ Violations BLOCKED with clear errors
- ✅ Agent MUST follow workflow
- ✅ Traces logged automatically

---

## 📝 NEXT STEPS AFTER TESTING

1. **If Protocol Ignored by Agent:**

    - Wire Pre-Hook to enforce blocking
    - See `FINAL_IMPLEMENTATION_STATUS.md` Priority 1

2. **If Protocol Followed Voluntarily:**

    - Consider current implementation sufficient
    - Pre-Hook as optional hardening layer

3. **If Tool Parameters Needed:**

    - Extend `write_to_file` schema (Priority 3)
    - Add `intent_id` and `mutation_class`

4. **If Trace Logging Needed:**
    - Wire Post-Hook (Priority 2)
    - Log to `agent_trace.jsonl`

---

**Test Plan Version:** 1.0  
**Last Updated:** February 18, 2026  
**Next Review:** After F5 test execution
