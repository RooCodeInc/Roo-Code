/**
 * Claude Code ACP Integration
 *
 * This module provides integration with Claude Code through the
 * Agent Client Protocol (ACP) using the @zed-industries/claude-code-acp adapter.
 */

export * from "./types"
export { AcpClient, getSharedAcpClient, resetSharedAcpClient } from "./acp-client"
export { ClaudeCodeAcpSessionManager, getSharedSessionManager, disposeSharedSessionManager } from "./session-manager"
