/**
 * Entry point for the SolidJS/opentui TUI.
 *
 * This file initializes the opentui renderer and mounts the SolidJS app.
 * It is built separately from the main CLI entry using:
 *   bun build src/ui-next/main.tsx --outdir=dist/ui-next --target=bun --external "@vscode/ripgrep"
 *
 * Run with:
 *   ROO_CLI_ROOT=$(pwd) bun dist/ui-next/main.js
 */

import { render } from "@opentui/solid"
import { App, type TUIAppProps } from "./app.js"

/**
 * Start the SolidJS/opentui TUI.
 * Called from the CLI run command when TUI mode is enabled.
 */
export async function startTUI(props: TUIAppProps): Promise<void> {
	await render(() => <App {...props} />)
}

// When run directly (standalone mode), parse minimal args and start
if (import.meta.main || process.argv[1]?.includes("ui-next")) {
	// This path is for the standalone build:
	// ROO_CLI_ROOT=$(pwd) bun dist/ui-next/main.js
	console.log("Roo Code CLI TUI (SolidJS/opentui)")
	console.log("This module should be imported and called via startTUI()")
	console.log("Use the main CLI: roo <prompt>")
	process.exit(0)
}
