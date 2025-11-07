vi.mock("vscode", () => {
	const executeCommand = vi.fn()
	const writeText = vi.fn()
	const showInformationMessage = vi.fn()
	const showErrorMessage = vi.fn()
	const file = vi.fn((p: string) => ({ fsPath: p, path: p, scheme: "file" }))
	const parse = (input: string) => {
		if (input.startsWith("https://")) {
			const url = new URL(input)
			// More secure check: ensure vscode-cdn.net is the actual domain, not just a substring
			if (url.host === "vscode-cdn.net" || url.host.endsWith(".vscode-cdn.net")) {
				return {
					scheme: "https",
					authority: url.host,
					path: url.pathname,
					fsPath: url.pathname,
					with: vi.fn(),
				}
			}
		}
		if (input.startsWith("file://")) {
			return {
				scheme: "file",
				authority: "",
				path: input.substring("file://".length),
				fsPath: input.substring("file://".length),
				with: vi.fn(),
			}
		}
		return {
			scheme: "file",
			authority: "",
			path: input,
			fsPath: input,
			with: vi.fn(),
		}
	}
	return {
		commands: { executeCommand },
		env: { clipboard: { writeText } },
		window: { showInformationMessage, showErrorMessage },
		Uri: { file, parse },
	}
})

import * as vscode from "vscode"
import { openImage } from "../image-handler"

describe("openImage - vscode webview CDN url handling", () => {
	const cdnUrlPosix = "https://file+.vscode-resource.vscode-cdn.net/file//Users/test/workspace/image.png"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("opens image from vscode-cdn webview URL by stripping /file/ and normalizing", async () => {
		await openImage(cdnUrlPosix)

		// Should normalize to /Users/test/workspace/image.png and open it
		expect((vscode.Uri.file as any).mock.calls.length).toBe(1)
		const calledWithPath = (vscode.Uri.file as any).mock.calls[0][0]
		expect(calledWithPath).toBe(require("path").normalize("/Users/test/workspace/image.png"))

		expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1)
		expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
			"vscode.open",
			expect.objectContaining({ fsPath: calledWithPath }),
		)
		expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
	})

	test("copy action writes normalized fs path to clipboard (no open)", async () => {
		await openImage(cdnUrlPosix, { values: { action: "copy" } })

		const expectedPath = require("path").normalize("/Users/test/workspace/image.png")
		expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(expectedPath)
		expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
	})
})
