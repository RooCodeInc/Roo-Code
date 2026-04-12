import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { initWebviewConsoleBridge } from "./features/devtools/utils/webviewConsoleBridge"

// Must be called before any other code to capture all console output
initWebviewConsoleBridge()

import "./index.css"
import App from "./App"
import "../node_modules/@vscode/codicons/dist/codicon.css"

import { getHighlighter } from "./utils/highlighter"

// Initialize Shiki early to hide initialization latency (async)
getHighlighter().catch((error: Error) => console.error("Failed to initialize Shiki highlighter:", error))

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
