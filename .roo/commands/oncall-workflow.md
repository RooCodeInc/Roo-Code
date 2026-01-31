---
description: "Run a specific oncall workflow"
argument-hint: "[workflow-name]"
mode: oncall
---

Execute an oncall workflow. Provide the workflow name as an argument.

Examples:

- `/oncall-workflow k8s-troubleshooting` - Run Kubernetes troubleshooting
- `/oncall-workflow service-specific/example-service-runbook` - Run service runbook

The workflow will be read from `.roo/workflows/oncall/{workflow-name}.md` and executed step-by-step.
