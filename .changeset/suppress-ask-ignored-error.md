---
"roo-cline": patch
---

Fix "Current ask promise was ignored" error leaking to LLM output

The `Task.ask()` method throws this error as a control flow mechanism for partial UI updates
and superseded asks. While callers already handle this with `.catch(() => {})`, the error
was leaking through `handleError()` in `presentAssistantMessage.ts`, causing it to be
reported to the LLM and confuse the conversation.

This change suppresses the error in `handleError()` since it's an expected control flow
signal, not a real error that needs to be reported.
