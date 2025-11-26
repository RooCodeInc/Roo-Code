# GitHub Feature Request Form - VPN-Aware Error Messages

Use this content to fill in the form at:
https://github.com/RooCodeInc/Roo-Code/issues/new?template=feature_request.yml

---

## Title
```
Improve error messages for VPN-required connection failures
```

---

## Problem (one or two sentences)
**What problem are users facing?**

```
When using Roo Code with internal/corporate API endpoints that require VPN connectivity, users receive generic "Connection error" messages with no guidance about the root cause, leading to confusion, wasted debugging time, and increased support burden for enterprise deployments.
```

---

## Context (who is affected and when)
**Who encounters this and in what situation?**

```
Enterprise users and developers working with internal AI services (such as Kong AI Gateway, internal OpenAI-compatible endpoints, or other corporate API services) behind corporate networks encounter this issue whenever they attempt to use Roo Code without an active VPN connection. This also affects users who lose VPN connectivity mid-session or experience VPN instability.
```

---

## Desired behavior (conceptual, not technical)
**Describe what should happen in simple terms.**

```
When a connection to an AI provider fails, Roo Code should tell users *why* it failed and *what to do about it*. Instead of generic "Connection error" messages, users should see clear guidance like:
- "Cannot resolve hostname - check your VPN connection" for DNS failures
- "Service refused connection - verify it's running" for connection refused errors  
- "Request timed out - check VPN stability" for timeout errors

This helps users quickly identify and fix the problem without debugging.
```

---

## Constraints / preferences (optional)
**Any considerations like performance, accessibility, or UX expectations.**

```
- Error messages should be clear and actionable without being verbose
- Should distinguish between different network failure types (DNS, connection, timeout)
- Must preserve detailed error logging for debugging purposes
- Should not add significant performance overhead
- Messages should be helpful for both technical and non-technical users
```

---

## Acceptance criteria (optional)
**Define what "working" looks like with specific, testable outcomes.**

```
Given a user attempts to connect to an AI provider endpoint that requires VPN
When the hostname cannot be resolved (DNS failure)
Then Roo Code displays: "Cannot resolve hostname. This usually means you need to connect to your corporate VPN to access internal services."
And the technical error details are logged for debugging
But the generic "Connection error" message is not shown

Given a user attempts to connect to an AI provider endpoint
When the connection is refused (service not running)
Then Roo Code displays: "Service refused connection. The API endpoint is reachable but not accepting connections."
And suggests verifying the service is running

Given a user attempts to connect to an AI provider endpoint
When the connection times out
Then Roo Code displays: "Request timed out. If using an internal service, verify your VPN connection is stable."
And distinguishes this from other error types
```

---

## Proposed approach (optional)
**If you have an idea, describe it briefly in plain language.**

```
Enhance the error handler to inspect error messages for specific patterns:
- DNS resolution failures (ENOTFOUND, "Could not resolve host")
- Connection refused errors (ECONNREFUSED)
- Timeout errors (ETIMEDOUT)

For each pattern, provide a context-aware error message that guides users to the likely solution (VPN connection for internal endpoints, service verification for refused connections, stability check for timeouts).

I have already implemented this enhancement and can submit a PR immediately upon assignment.
```

---

## Trade-offs / risks (optional)
**Potential downsides or alternatives considered.**

```
**Trade-offs:**
- Slightly more complex error handling logic (minimal - pattern matching only)
- Error messages are longer than generic "Connection error" (but much more helpful)

**Risks:**
- Low risk - changes only affect error message formatting
- Preserves all existing error logging and debugging capabilities
- Does not change API or core functionality

**Alternatives considered:**
- Status quo (generic error messages) - rejected due to poor UX
- AI-powered error analysis - too complex for this use case
- Configuration option for verbose errors - unnecessary complexity
```

---

## Additional Notes

**Current Behavior (Before):**
```
OpenAI completion error: Connection error.
Retry attempt 1
Retrying now...
```

**Improved Behavior (After):**
```
OpenAI connection error: Cannot resolve hostname. This usually means you need to connect to your corporate VPN to access internal services. If you're using an internal API endpoint (e.g., *.use.ucdp.net), please verify your VPN connection is active.
```

**Alignment with Roadmap:**
This enhancement aligns with the **Enhanced User Experience** roadmap goal by:
- Streamlining error messages for clarity and intuitiveness
- Reducing friction points that deter regular usage
- Improving workflow for enterprise users with internal API services

---

## Checklist Items

☑ **I've searched existing Issues and Discussions for duplicates**
☑ **This describes a specific problem with clear context and impact**

---

## Labels to Request
- `enhancement` (should be auto-applied by template)
- Optionally: `good first issue` (implementation is straightforward)
- Optionally: `ux` (user experience improvement)
