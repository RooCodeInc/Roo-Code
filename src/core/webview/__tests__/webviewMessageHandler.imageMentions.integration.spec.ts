import * as fs from "fs/promises"
import * as path from "path"

// Must mock dependencies before importing the handler module.
vi.mock("../../../api/providers/fetchers/modelCache")

import { webviewMessageHandler } from "../webviewMessageHandler"
import type { ClineProvider } from "../ClineProvider"

vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
	},
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
	},
}))

describe("webviewMessageHandler - image mentions (integration)", () => {
	it("resolves image mentions for newTask and passes images to createTask", async () => {
		const tmpRoot = await fs.mkdtemp(path.join(process.cwd(), "tmp-image-mentions-"))
		try {
			const imgBytes = Buffer.from("png-bytes")
			await fs.writeFile(path.join(tmpRoot, "cat.png"), imgBytes)

			const mockProvider = {
				cwd: tmpRoot,
				getCurrentTask: vi.fn().mockReturnValue(undefined),
				createTask: vi.fn().mockResolvedValue(undefined),
				postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			} as unknown as ClineProvider

			await webviewMessageHandler(mockProvider, {
				type: "newTask",
				text: "Please look at @/cat.png",
				images: [],
			} as any)

			expect(mockProvider.createTask).toHaveBeenCalledWith("Please look at @/cat.png", [
				`data:image/png;base64,${imgBytes.toString("base64")}`,
			])
		} finally {
			await fs.rm(tmpRoot, { recursive: true, force: true })
		}
	})

	it("resolves image mentions for askResponse and passes images to handleWebviewAskResponse", async () => {
		const tmpRoot = await fs.mkdtemp(path.join(process.cwd(), "tmp-image-mentions-"))
		try {
			const imgBytes = Buffer.from("jpg-bytes")
			await fs.writeFile(path.join(tmpRoot, "cat.jpg"), imgBytes)

			const handleWebviewAskResponse = vi.fn()
			const mockProvider = {
				cwd: tmpRoot,
				getCurrentTask: vi.fn().mockReturnValue({
					cwd: tmpRoot,
					handleWebviewAskResponse,
				}),
			} as unknown as ClineProvider

			await webviewMessageHandler(mockProvider, {
				type: "askResponse",
				askResponse: "messageResponse",
				text: "Please look at @/cat.jpg",
				images: [],
			} as any)

			expect(handleWebviewAskResponse).toHaveBeenCalledWith("messageResponse", "Please look at @/cat.jpg", [
				`data:image/jpeg;base64,${imgBytes.toString("base64")}`,
			])
		} finally {
			await fs.rm(tmpRoot, { recursive: true, force: true })
		}
	})
})
