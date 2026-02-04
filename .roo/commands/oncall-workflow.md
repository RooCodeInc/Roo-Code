---
description: "Run a specific oncall workflow"
argument-hint: "[workflow-name]"
mode: oncall
---

Execute an oncall workflow. The workflow name is provided as an argument.

Read and execute the workflow file from `.roo/rules-oncall/{workflow-name}.md` step-by-step.

If no workflow name is provided, list available workflows in `.roo/rules-oncall/` and ask the user which one to execute.

Examples:

- `/oncall-workflow k8s-troubleshooting` - Execute `k8s-troubleshooting.md`
- `/oncall-workflow service-specific/example-service-runbook` - Execute `service-specific/example-service-runbook.md`
