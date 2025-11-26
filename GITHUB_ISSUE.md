# GitHub Issue: Improve error messages for VPN-required connection failures

**Issue Type:** Enhancement Request

## Problem
When using Roo Code with internal/corporate API endpoints that require VPN connectivity (such as Kong AI Gateway or other enterprise services behind corporate networks), users receive generic "Connection error" messages that provide no guidance about the root cause.

**Current Error Message:**
```
OpenAI completion error: Connection error.
Retry attempt 1
Retrying now...
```

This leads to:
- User confusion and frustration
- Increased support burden
- Time wasted debugging network issues
- Poor enterprise deployment experience

## Proposed Solution
Enhance the error handler to detect specific network error patterns and provide context-aware error messages:

1. **DNS Resolution Failures** (ENOTFOUND, "Could not resolve host", getaddrinfo)
2. **Connection Refused Errors** (ECONNREFUSED)  
3. **Timeout Errors** (ETIMEDOUT)

Each error type should provide specific guidance about VPN requirements.

## User Benefit
- Immediate clarity on what action to take (connect to VPN)
- Reduced debugging and support time
- Better enterprise deployment experience
- Specific guidance for internal endpoints (e.g., *.use.ucdp.net, internal Kong gateways)
- Distinguishes between different network failure types

## Expected Behavior

**DNS Resolution Failure:**
```
OpenAI connection error: Cannot resolve hostname. 
This usually means you need to connect to your corporate VPN to access internal services. 
If you're using an internal API endpoint (e.g., *.use.ucdp.net), 
please verify your VPN connection is active.
```

**Connection Refused:**
```
OpenAI connection error: Service refused connection. 
The API endpoint is reachable but not accepting connections. 
Please verify the service is running and the port is correct.
```

**Timeout:**
```
OpenAI connection error: Request timed out. 
The API endpoint may be unreachable or experiencing issues. 
If using an internal service, verify your VPN connection is stable.
```

## Alignment with Roadmap
This enhancement aligns with the **Enhanced User Experience** roadmap goal by:
- Streamlining the UX for clarity and intuitiveness
- Reducing friction points that deter regular usage
- Improving workflow to meet high expectations for daily-use tools

## Implementation Note
I have already implemented this enhancement and can submit a PR immediately upon assignment.
