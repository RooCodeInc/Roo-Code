# Hooks

This folder contains hook points used to make tool execution deterministic and auditable.

## Purpose

Hooks provide a controlled interception layer for:

- Tool call parsing and validation
- Tool dispatch and execution
- File system writes and side effects
- Prompt assembly and instruction injection

## Design goals

- Deterministic behavior across runs
- Clear audit trail of intent -> action
- Minimal coupling to UI and providers
- Safe rollback when a hook vetoes a tool

## Conventions

- Keep hook interfaces small and explicit
- Prefer pure functions where possible
- Avoid direct filesystem writes in hooks; delegate to execution layer
- Log decisions and include tool call IDs when available

## Suggested layout

- parsers/: normalize incoming tool calls
- dispatch/: gate and route tool actions
- prompts/: assemble or modify system prompts
- filesystem/: guard write operations

## Notes

This README documents the intent for the hooks layer. Update it when adding new hook types or lifecycle stages.
