<!-- Powered by BMAD-CORE™ -->

# Test Design and Risk Assessment

**Workflow ID**: `_bmad/tea/testarch/test-design`
**Version**: 5.0 (Step-File Architecture)

---

## Overview

Plans comprehensive test coverage strategy with risk assessment, priority classification, and execution ordering. This workflow operates in **two modes**:

- **System-Level Mode (Phase 3)**: Testability review of architecture before solutioning gate check
- **Epic-Level Mode (Phase 4)**: Per-epic test planning with risk assessment

The workflow auto-detects which mode to use based on project phase and user intent.

---

## WORKFLOW ARCHITECTURE

This workflow uses **step-file architecture** for disciplined execution:

### Core Principles

- **Micro-file Design**: Each step is a self-contained instruction file
- **Just-In-Time Loading**: Only the current step file is in memory
- **Sequential Enforcement**: Execute steps in order without skipping
- **State Tracking**: Write outputs only when instructed, then proceed

### Step Processing Rules (Non-Negotiable)

1. **READ COMPLETELY**: Read the entire step file before taking any action
2. **FOLLOW SEQUENCE**: Execute all numbered sections in order
3. **WAIT FOR INPUT**: Halt when user input is required
4. **LOAD NEXT**: Only load the next step file when directed

---

## INITIALIZATION SEQUENCE

### 1. Configuration Loading

From `workflow.yaml`, resolve:

- `config_source`, `output_folder`, `user_name`, `communication_language`, `document_output_language`, `date`

### 2. First Step

Load, read completely, and execute:
`{project-root}/_bmad/tea/workflows/testarch/test-design/steps-c/step-01-detect-mode.md`
