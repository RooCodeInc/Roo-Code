---
description: Learn about context poisoning in AI coding assistants, its symptoms, causes, and effective recovery strategies to maintain accurate AI responses.
keywords:
    - context poisoning
    - AI accuracy
    - Roo Code troubleshooting
    - LLM context management
    - session recovery
image: /img/social-share.jpg
---

# Context Poisoning

:::info
Context poisoning is a persistent issue within a given session. Once a chat session's context is compromised, treat that session as disposable. Starting fresh with a clean context is crucial for maintaining the accuracy and effectiveness of your Roo Code agent.
:::

Context poisoning occurs when inaccurate or irrelevant data contaminates the language model's active context. This leads the model to draw incorrect conclusions, provide erroneous information to tools, and progressively deviate from the intended task with each interaction.

---

## Symptoms of Context Poisoning

Identify context poisoning by observing these behaviors:

- **Degraded Output Quality:** Suggestions become nonsensical, repetitive, or irrelevant.
- **Tool Misalignment:** Tool calls no longer correspond to the user's requests.
- **Orchestration Failures:** Orchestrator chains may stall, loop indefinitely, or fail to complete.
- **Temporary Fixes:** Re-applying a clean prompt or instructions offers only brief respite before issues resurface.
- **Tool Usage Confusion:** The model struggles to correctly use or recall how to use tools defined in the system prompt.

---

## Common Causes

Context poisoning can be triggered by several factors:

- **Model Hallucination:** The model generates an incorrect piece of information and subsequently treats it as a factual part of the context.
- **Code Comments:** Outdated, incorrect, or ambiguous comments in the codebase can be misinterpreted by the model, leading it down the wrong path.
- **Contaminated User Input:** Copy-pasting logs or text containing hidden or rogue control characters.
- **Context Window Overflow:** As a session grows, older, useful information may be pushed out of the model's limited context window, allowing "poisoned" data to have a greater relative impact.

Once bad data enters the context, it tends to persist. The model re-evaluates this tainted information in subsequent reasoning cycles, similar to a permanent flaw affecting its perception until the context is completely reset.

---

## Can a "Wake-Up Prompt" Resolve Context Poisoning?

**Short Answer:** No.

A corrective prompt might temporarily suppress symptoms, but the problematic data remains in the conversational buffer. The model will likely revert to the poisoned state as soon as the interaction deviates from the narrow scope of the corrective prompt.

**Detailed Explanation:**

- Re-injecting the full set of tool definitions or core directives can sometimes mask the damage for one or some interactions following the initial context poisoning .
- However, the underlying poisoned context remains. Any query or task outside the immediate "patch" will likely re-trigger the original issue.
- This approach is unreliable, akin to placing a warning label on a leaking pipe instead of repairing it.

---

## Effective Recovery Strategies

To reliably recover from context poisoning:

- **Hard Reset the Session:** The most dependable solution is to start a new chat session. This clears the contaminated context entirely.
- **Minimize Manual Data Dumps:** When pasting logs or other data, be selective. Only include the essential information the model requires.
- **Manage Context Window Size:** For large or complex tasks, consider breaking them into smaller, focused chat sessions. This helps ensure that stale or irrelevant information ages out of the context window more quickly.
- **Validate Tool Output:** If a tool returns nonsensical or clearly incorrect data, delete that message from the chat history before the model can process it and incorporate it into its context.

---

## Addressing a Common Question: The "Magic Bullet" Prompt

A frequent question from the community is:

> "Have you found a prompt that wakes it back up? Maybe a prompt that just has the tools instructions we can push back in manually?”

As explained, no single prompt offers a lasting fix. Any immediate improvement is superficial because the corrupted lines of text persist in the session's history, ready to cause further issues. The only robust solution is to discard the compromised session, initiate a new one, and provide it with a clean prompt and the correct tool definitions from the outset.
