# Improve error messages for VPN-required connection failures

When using Roo Code with internal/corporate API endpoints that require VPN connectivity, users receive generic "Connection error" messages with no guidance about the root cause. Enhance the error handler to detect DNS resolution failures, connection refused errors, and timeouts, providing specific VPN connection guidance that reduces debugging time and improves the enterprise user experience.

## Context (who is affected and when)
Enterprise users who configure Roo Code to use internal AI services (like Kong AI Gateway or corporate-hosted LLM endpoints) encounter this when their VPN connection is inactive or unstable. This affects developers working remotely or switching between networks who may not immediately realize their corporate services are unreachable.

## Desired behavior (conceptual, not technical)
When a connection to an AI provider fails, Roo Code should tell users *why* it failed and *what to do about it*. Instead of generic "Connection error" messages, users should see clear guidance like "Cannot connect - check your VPN" for DNS failures, "Service unavailable - verify it's running" for connection refused, or "Request timed out - check VPN stability" for timeouts.

## Context (who is affected and when)

Enterprise users and developers working with internal AI services (such as Kong AI Gateway, internal OpenAI-compatible endpoints, or other corporate API services) behind corporate networks encounter this issue whenever they attempt to use Roo Code without an active VPN connection. This also affects users who lose VPN connectivity mid-session or experience VPN instability.
