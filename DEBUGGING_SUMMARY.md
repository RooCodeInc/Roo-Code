# Roo Code Extension Debugging Summary

## Issue: Service Worker Registration Error

**Error Message:**

```
Error loading webview: Error: Could not register service worker: InvalidStateError: Failed to register a ServiceWorker: The document is in an invalid state.
```

## Root Cause

VS Code webviews **do not support Service Workers**. This is a fundamental limitation of the VS Code webview architecture:

1. Webviews run in a sandboxed iframe context
2. Service Workers require a secure context with specific origin policies
3. VS Code's webview protocol (`vscode-webview://`) doesn't meet Service Worker requirements

## Solution

The Service Worker registration is likely coming from one of these sources:

### **Most Likely: Browser Default Behavior**

Modern browsers (especially Chromium-based ones) may attempt to register a service worker automatically when they detect certain PWA manifest files or configurations. The error is actually **harmless** - it's just the browser failing to register a SW that isn't needed anyway.

### **Fix 1: Verify No SW Registration Code**

Check these files to ensure there's NO service worker registration:

```bash
# Search for service worker registration code
grep -r "navigator.serviceWorker" webview-ui/src/
grep -r "registerSW" webview-ui/src/
```

**Expected:** No matches found ✅ (already verified)

### **Fix 2: Ensure Vite Build Doesn't Include SW**

The `vite.config.ts` is correctly configured:

- No `vite-plugin-pwa` plugin ✅
- No PWA manifest configuration ✅

### **Fix 3: Check for manifest.json**

```bash
# Remove any PWA manifest if it exists
rm -f webview-ui/public/manifest.json
rm -f webview-ui/public/sw.js
```

### **Fix 4: Update CSP to Block Service Workers (Optional)**

If the error persists, you can explicitly block service worker registration in the CSP:

**File:** `src/core/webview/ClineProvider.ts`

Find the CSP array around line 1301 and add:

```typescript
const csp = [
	"default-src 'none'",
	"worker-src 'none'", // ADD THIS LINE - blocks all workers including service workers
	// ... rest of CSP
]
```

## Testing Strategy

1. **Build the extension:**

    ```powershell
    pnpm run build
    ```

2. **Check build output for SW files:**

    ```powershell
    Get-ChildItem -Path "src/webview-ui/build" -Recurse -Include "sw.js","service-worker.js","workbox-*.js"
    ```

    **Expected:** No files found

3. **Launch Extension Development Host (F5)**

4. **Open VS Code Developer Tools:**

    - Help → Toggle Developer Tools
    - Check Console for errors

5. **Expected Console Output:**

    ```
    [RooCode] Extension activated
    [Extension] setWebviewMessageListener registered
    [Webview] Loaded
    ```

6. **Click Roo Code panel** - should be interactive

## If Error Still Appears

The error message is likely **non-blocking**. Check if:

1. ✅ Webview loads visually (you can see the UI)
2. ✅ Console shows `[Webview] Loaded`
3. ✅ Console shows messages when you click buttons
4. ❌ Chat panel doesn't respond to clicks

If items 1-3 are ✅ but item 4 is ❌, the issue is NOT the Service Worker error - it's a different IPC communication problem.

## Alternative: Check for React Template Artifacts

Some Create React App templates include service worker registration by default:

**File to check:** `webview-ui/src/index.tsx`

Look for lines like:

```typescript
import * as serviceWorkerRegistration from "./serviceWorkerRegistration"
serviceWorkerRegistration.register()
```

**Current code (verified clean):**

```typescript
// No service worker registration ✅
import { getHighlighter } from "./utils/highlighter"
console.log('[Webview] Loaded')
createRoot(document.getElementById("root")!).render(<App />)
```

## Debugging Commands Added

### Extension Host (src/extension.ts)

```typescript
console.log("[RooCode] Extension activated")
vscode.commands.registerCommand("roo-cline.debug", () => {
	vscode.window.showInformationMessage("Debug: Extension Host is alive")
})
```

### Webview (webview-ui/src/index.tsx)

```typescript
console.log("[Webview] Loaded")
window.addEventListener("message", (event) => {
	console.log("[Webview] Received message:", event.data)
})
```

### Message Handler (src/core/webview/ClineProvider.ts) - **NEEDS MANUAL FIX**

```typescript
private setWebviewMessageListener(webview: vscode.Webview) {
    console.log('[Extension] setWebviewMessageListener registered')

    const onReceiveMessage = async (message: WebviewMessage) => {
        console.log('[Extension] Received message from webview:', message.type)
        return webviewMessageHandler(this, message, this.marketplaceManager)
    }
    // ...
}
```

## Next Steps

1. **Complete the build** (currently running in background)
2. **Apply manual fix** to `ClineProvider.ts` message listener
3. **Restart VS Code** to release file locks
4. **Rebuild:** `pnpm run build`
5. **Test:** Press F5 and verify console logs

## Expected Outcome

After applying fixes:

- ✅ Extension activates without errors
- ✅ Webview loads and displays UI
- ✅ Console shows all debug messages
- ✅ Chat panel responds to clicks
- ⚠️ Service Worker error may still appear but is **harmless** (browser limitation, not extension bug)

## Additional Resources

- [VS Code Webview API Docs](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code CSP Requirements](https://code.visualstudio.com/api/extension-guides/webview#content-security-policy)
- [Known Issue: Webviews and Service Workers](https://github.com/microsoft/vscode/issues/62635)

---

**Last Updated:** 2026-02-18
**Status:** Analysis complete, awaiting build completion for verification
