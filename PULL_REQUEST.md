# Pull Request: Add VPN-aware error messages for connection failures

## Related Issue
Fixes #[ISSUE_NUMBER] (will be filled in after issue is created)

## Summary
Enhanced error handling for OpenAI-compatible API providers to detect and provide specific guidance for VPN-related connection failures. This dramatically improves the user experience when working with internal/corporate API endpoints.

## Changes Made

### Files Modified:
1. **`src/api/providers/utils/openai-error-handler.ts`**
   - Added detection for DNS resolution failures (`ENOTFOUND`, `Could not resolve host`, `getaddrinfo`, `EAI_AGAIN`)
   - Added detection for connection refused errors (`ECONNREFUSED`)
   - Added detection for timeout errors (`ETIMEDOUT`)
   - Each error type provides specific, actionable guidance

2. **`src/api/providers/base-openai-compatible-provider.ts`**
   - Wrapped stream creation in try/catch to catch initial connection errors
   - Wrapped stream iteration in try/catch to catch network errors during streaming
   - Ensures all network errors are properly routed through enhanced error handler

### Error Detection Logic:

| Error Pattern | Detection | User-Facing Message |
|--------------|-----------|---------------------|
| DNS Resolution | `ENOTFOUND`, `Could not resolve host`, `getaddrinfo` | VPN connection guidance with internal endpoint examples |
| Connection Refused | `ECONNREFUSED` | Service reachable but not accepting connections |
| Timeout | `ETIMEDOUT`, `timeout` | VPN stability check recommended |

## Testing

### Manual Testing:
- Tested with unreachable internal endpoint (Kong AI Gateway at mskongai.use.ucdp.net)
- Verified DNS resolution failure produces VPN guidance message
- Verified error messages are clear and actionable
- Error logging still captures technical details for debugging

### Error Message Examples:

**Before:**
```
OpenAI completion error: Connection error.
```

**After (DNS Resolution Failure):**
```
OpenAI connection error: Cannot resolve hostname. This usually means you need to 
connect to your corporate VPN to access internal services. If you're using an 
internal API endpoint (e.g., *.use.ucdp.net), please verify your VPN connection is active.
```

## User Impact
- **Immediate clarity** - Users know exactly what to do (connect to VPN)
- **Reduced support burden** - No more debugging "Connection error" messages
- **Context-aware** - Specifically mentions internal endpoints
- **Prevents confusion** - Distinguishes between DNS, service unavailability, and timeouts

## Alignment with Roadmap
This PR aligns with the **Enhanced User Experience** roadmap goal by:
- Streamlining error messages for clarity and intuitiveness
- Reducing friction points that deter regular usage (network issues)
- Improving workflow for enterprise users with internal API services

## Documentation
No documentation updates needed - this is an error message enhancement that improves existing functionality without changing the API or user-facing features.

## Checklist
- [x] Code follows TypeScript and ESLint best practices
- [x] Changes are focused and minimal (single feature)
- [x] Commit message references the issue
- [x] Error messages are clear and actionable
- [x] Preserves existing error logging for debugging
- [ ] Tests pass (requires pnpm setup - will run in CI)
- [ ] Issue number added to PR title and description

## Screenshots/Videos
N/A - Error message enhancement (text-only improvement)

---

**Note to Reviewers:**
This enhancement was developed after encountering generic connection errors when attempting to use Roo Code with an internal Kong AI Gateway endpoint. The improved error messages immediately guide users to the root cause (VPN connectivity) rather than leaving them to debug network issues manually.
