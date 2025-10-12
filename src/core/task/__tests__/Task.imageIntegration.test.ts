import * as fs from "fs/promises"
import * as path from "path"
import os from "os"
import { ProviderSettings } from "@roo-code/types"
import { Task } from "../Task"
import { ImageManager } from "../../image-storage/ImageManager"

// Mock dependencies
vi.mock("../../ignore/RooIgnoreController")
vi.mock("../../protect/RooProtectedController")
vi.mock("../../context-tracking/FileContextTracker")
vi.mock("../../../services/browser/UrlContentFetcher")
vi.mock("../../../services/browser/BrowserSession")
vi.mock("../../../integrations/editor/DiffViewProvider")
vi.mock("../../tools/ToolRepetitionDetector")
vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn(() => ({
		getModel: () => ({ info: {}, id: "test-model" }),
	})),
}))
vi.mock("../AutoApprovalHandler")

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureTaskCreated: vi.fn(),
			captureTaskRestarted: vi.fn(),
			captureMemoryUsage: vi.fn(),
			captureMemoryWarning: vi.fn(),
			captureImageCleanup: vi.fn(),
		},
		hasInstance: () => true,
		createInstance: vi.fn(),
	},
}))

// Mock vscode
vi.mock("vscode", () => ({
	window: {
		createTextEditorDecorationType: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
		visibleTextEditors: [],
		tabGroups: {
			all: [],
			close: vi.fn(),
			onDidChangeTabs: vi.fn(() => ({ dispose: vi.fn() })),
		},
	},
	workspace: {
		workspaceFolders: [
			{
				uri: { fsPath: "/mock/workspace/path" },
				name: "mock-workspace",
				index: 0,
			},
		],
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
			onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
			onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
			dispose: vi.fn(),
		})),
		fs: {
			stat: vi.fn().mockResolvedValue({ type: 1 }),
		},
		onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		getConfiguration: vi.fn(() => ({ get: (key: string, defaultValue: any) => defaultValue })),
	},
	RelativePattern: vi.fn(),
	EventEmitter: vi.fn().mockImplementation(() => ({
		event: vi.fn(),
		fire: vi.fn(),
	})),
	Disposable: {
		from: vi.fn(),
	},
}))

describe("Task - ImageManager Integration", () => {
	let testDir: string
	let task: Task
	let mockProvider: any
	let mockApiConfiguration: ProviderSettings

	beforeEach(async () => {
		// Create a temporary directory for testing
		testDir = path.join(os.tmpdir(), `roo-test-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })

		// Mock provider
		mockProvider = {
			context: {
				globalStorageUri: {
					fsPath: testDir,
				},
			},
			getState: vi.fn().mockResolvedValue({
				mode: "code",
			}),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			updateTaskHistory: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
		}

		// Mock API configuration
		mockApiConfiguration = {
			apiProvider: "anthropic",
			apiKey: "test-key",
			apiModelId: "claude-3-5-sonnet-20241022",
		} as ProviderSettings

		// Create task instance
		task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})
	})

	afterEach(async () => {
		// Clean up
		if (task) {
			task.dispose()
		}
		// Remove test directory
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch (error) {
			// Ignore cleanup errors
		}
	})

	it("should externalize Base64 images when adding messages", async () => {
		const base64Image =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

		// Add message with Base64 image
		await task["addToClineMessages"]({
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Test message with image",
			images: [base64Image],
		})

		// Check that the message was added
		expect(task.clineMessages).toHaveLength(1)

		const message = task.clineMessages[0]

		// Verify that images field is removed and imageIds is set
		expect(message.images).toBeUndefined()
		expect(message.imageIds).toBeDefined()
		expect(message.imageIds).toHaveLength(1)

		// Verify that the image file was created
		const imageId = message.imageIds![0]
		const imagePath = path.join(testDir, "images", task.taskId, `${imageId}.png`)
		const imageExists = await fs
			.access(imagePath)
			.then(() => true)
			.catch(() => false)
		expect(imageExists).toBe(true)
	})

	it("should handle multiple images in a single message", async () => {
		const image1 =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
		const image2 =
			"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA/9k="

		await task["addToClineMessages"]({
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Test message with multiple images",
			images: [image1, image2],
		})

		const message = task.clineMessages[0]

		expect(message.images).toBeUndefined()
		expect(message.imageIds).toBeDefined()
		expect(message.imageIds).toHaveLength(2)

		// Verify both images were saved
		for (const imageId of message.imageIds!) {
			const imageManager = (task as any)["imageManager"]
			const loadedImage = await imageManager.loadImage(task.taskId, imageId)
			expect(loadedImage).toBeDefined()
			expect(loadedImage).toMatch(/^data:image\/(png|jpeg);base64,/)
		}
	})

	it("should preserve non-Base64 image references", async () => {
		// Non-Base64 reference (e.g., URL or file path)
		const imageRef = "https://example.com/image.png"

		await task["addToClineMessages"]({
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Test message with image reference",
			images: [imageRef],
		})

		const message = task.clineMessages[0]

		// Non-Base64 images should be preserved as-is
		expect(message.images).toBeDefined()
		expect(message.images).toEqual([imageRef])
		expect(message.imageIds).toBeUndefined()
	})

	it("should handle image save failures gracefully", async () => {
		// Create an invalid Base64 string
		const invalidImage = "data:image/png;base64,INVALID_BASE64"

		// Mock saveImages to throw an error
		const originalSaveImages = ImageManager.prototype.saveImages
		vi.spyOn(ImageManager.prototype, "saveImages").mockRejectedValue(new Error("Save failed"))

		await task["addToClineMessages"]({
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Test message with invalid image",
			images: [invalidImage],
		})

		const message = task.clineMessages[0]

		// On failure, should preserve original images
		expect(message.images).toBeDefined()
		expect(message.images).toEqual([invalidImage])
		expect(message.imageIds).toBeUndefined()

		// Restore original method
		vi.restoreAllMocks()
	})

	it("should clean up task images on dispose", async () => {
		const base64Image =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

		// Add message with image
		await task["addToClineMessages"]({
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Test message",
			images: [base64Image],
		})

		const message = task.clineMessages[0]
		const imageId = message.imageIds![0]
		const imagePath = path.join(testDir, "images", task.taskId, `${imageId}.png`)

		// Verify image exists
		let imageExists = await fs
			.access(imagePath)
			.then(() => true)
			.catch(() => false)
		expect(imageExists).toBe(true)

		// Dispose task (this should clean up images)
		task.dispose()

		// Wait a bit for async cleanup
		await new Promise((resolve) => setTimeout(resolve, 100))

		// Verify image directory was cleaned up
		const taskImageDir = path.join(testDir, "images", task.taskId)
		const dirExists = await fs
			.access(taskImageDir)
			.then(() => true)
			.catch(() => false)
		expect(dirExists).toBe(false)
	})

	it("should handle messages without images", async () => {
		await task["addToClineMessages"]({
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Test message without images",
		})

		const message = task.clineMessages[0]

		expect(message.images).toBeUndefined()
		expect(message.imageIds).toBeUndefined()
	})

	it("should handle empty images array", async () => {
		await task["addToClineMessages"]({
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Test message with empty images array",
			images: [],
		})

		const message = task.clineMessages[0]

		expect(message.images).toEqual([])
		expect(message.imageIds).toBeUndefined()
	})
})
