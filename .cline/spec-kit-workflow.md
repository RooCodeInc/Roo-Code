# Spec-Kit Workflow for Cline

This workflow file enables Cline to use spec-kit commands directly.

## Available Commands

### Core Workflow

- `sp_init` - Initialize spec-kit in project
- `sp_sp` - Create feature specification
- `sp_clarify` - Analyze spec for ambiguities
- `sp_pl` - Create implementation plan
- `sp_ts` - Generate task list
- `sp_impl` - Get all tasks for implementation
- `sp_done` - Mark task as complete
- `sp_ch` - Generate review checklist
- `sp_con` - Get/create constitution

### Utility Commands

- `sp_list` - List all features
- `sp_active` - Get next single task
- `sp_analyze` - Analyze cross-artifact consistency

## Workflow Steps

1. **Initialize**: `sp_init` (first time only)
2. **Specify**: `sp_sp` with feature description
3. **Clarify**: `sp_clarify` to check for issues (optional)
4. **Plan**: `sp_pl` with technical context
5. **Tasks**: `sp_ts` to generate task list
6. **Implement**: `sp_impl` to get all tasks, then implement each one
7. **Complete**: `sp_done` after each task
8. **Review**: `sp_ch` for final checklist

## Example Usage

```
Use sp_sp with:
  description: "User authentication system"
  projectRoot: "/path/to/project"

Then use sp_pl with:
  featureName: "001-user-auth"
  techContext: "Node.js with Express and PostgreSQL"
  projectRoot: "/path/to/project"
```

## Notes

- All commands require `projectRoot` parameter
- Feature names are auto-generated (001-feature-name format)
- Tasks are organized by user story for independent implementation
- Use `sp_impl` for full implementation workflow
