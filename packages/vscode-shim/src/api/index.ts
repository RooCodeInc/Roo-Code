/**
 * API exports for VSCode API
 *
 * This barrel file re-exports all API classes from the api directory
 */

export { FileSystemAPI } from "./FileSystemAPI.js"
export { MockWorkspaceConfiguration } from "./WorkspaceConfiguration.js"
export { WorkspaceAPI } from "./WorkspaceAPI.js"
export { TabGroupsAPI, type Tab, type TabInputText, type TabGroup } from "./TabGroupsAPI.js"
export { WindowAPI } from "./WindowAPI.js"
export { CommandsAPI } from "./CommandsAPI.js"
export { createVSCodeAPIMock } from "./create-vscode-api-mock.js"
