import { describe, it, expect } from "vitest"
import { createEditor } from "lexical"
import { $createMentionNode, $isMentionNode, MentionNode } from "./MentionNode"

describe("MentionNode", () => {
	it("should create a mention node with correct properties", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const mentionNode = $createMentionNode("@", "test-file.ts", "test-file.ts")

			expect($isMentionNode(mentionNode)).toBe(true)
			expect(mentionNode.getValue()).toBe("test-file.ts")
			expect(mentionNode.getLabel()).toBe("test-file.ts")
			expect(mentionNode.getTrigger()).toBe("@")
			expect(mentionNode.getTextContent()).toBe("@test-file.ts")
		})
	})

	it("should create a command mention node", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const mentionNode = $createMentionNode("/", "code", "code")

			expect($isMentionNode(mentionNode)).toBe(true)
			expect(mentionNode.getValue()).toBe("code")
			expect(mentionNode.getLabel()).toBe("code")
			expect(mentionNode.getTrigger()).toBe("/")
			expect(mentionNode.getTextContent()).toBe("/code")
		})
	})

	it("should serialize and deserialize correctly", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const mentionNode = $createMentionNode("@", "test-file.ts", "test-file.ts", undefined, { id: "123" })
			const serialized = mentionNode.exportJSON()

			expect(serialized.value).toBe("test-file.ts")
			expect(serialized.label).toBe("test-file.ts")
			expect(serialized.trigger).toBe("@")
			expect(serialized.data).toEqual({ id: "123" })
			expect(serialized.type).toBe("mention")

			const deserialized = MentionNode.importJSON(serialized)
			expect(deserialized.getValue()).toBe("test-file.ts")
			expect(deserialized.getLabel()).toBe("test-file.ts")
			expect(deserialized.getTrigger()).toBe("@")
			expect(deserialized.getData()).toEqual({ id: "123" })
		})
	})

	it("should clone correctly", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const original = $createMentionNode("@", "test-file.ts", "test-file.ts", undefined, { id: "123" })
			const cloned = MentionNode.clone(original)

			expect(cloned.getValue()).toBe(original.getValue())
			expect(cloned.getLabel()).toBe(original.getLabel())
			expect(cloned.getTrigger()).toBe(original.getTrigger())
			expect(cloned.getData()).toEqual(original.getData())
			expect(cloned.getTextContent()).toBe(original.getTextContent())
		})
	})

	it("should update value and label correctly", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const mentionNode = $createMentionNode("@", "old-file.ts", "old-file.ts")

			const withNewValue = mentionNode.setValue("new-file.ts")
			expect(withNewValue.getValue()).toBe("new-file.ts")

			const withNewLabel = withNewValue.setLabel("new-file.ts")
			expect(withNewLabel.getLabel()).toBe("new-file.ts")
			expect(withNewLabel.getTextContent()).toBe("@new-file.ts")
		})
	})

	it("should not allow text insertion before or after", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const mentionNode = $createMentionNode("@", "test-file.ts", "test-file.ts")

			expect(mentionNode.canInsertTextBefore()).toBe(false)
			expect(mentionNode.canInsertTextAfter()).toBe(false)
		})
	})

	it("should be a text entity", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const mentionNode = $createMentionNode("@", "test-file.ts", "test-file.ts")

			expect(mentionNode.isTextEntity()).toBe(true)
		})
	})

	it("should support value and label", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const mentionNode = $createMentionNode("@", "/path/to/filename.ts", "filename.ts", undefined, {
				type: "file",
			})

			expect(mentionNode.getValue()).toBe("/path/to/filename.ts")
			expect(mentionNode.getLabel()).toBe("filename.ts")
		})
	})

	it("should format file mentions with @file: prefix", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const mentionNode = $createMentionNode("@", "/path/to/file.ts", "file.ts", undefined, { type: "file" })

			expect(mentionNode.getFormattedDisplayText()).toBe("@file:file.ts")
		})
	})

	it("should format directory mentions with @dir: prefix", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const mentionNode = $createMentionNode("@", "/path/to/dir/", "/path/to/dir/", undefined, { type: "folder" })

			expect(mentionNode.getFormattedDisplayText()).toBe("@dir:/path/to/dir/")
		})
	})

	it("should format git mentions with @git: prefix", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const mentionNode = $createMentionNode("@", "abc123def456", "abc123", undefined, { type: "git" })

			expect(mentionNode.getFormattedDisplayText()).toBe("@git:abc123")
		})
	})

	it("should format url mentions with @url: prefix", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const mentionNode = $createMentionNode("@", "https://example.com", "example.com", undefined, {
				type: "url",
			})

			expect(mentionNode.getFormattedDisplayText()).toBe("@url:example.com")
		})
	})

	it("should keep standard format for mentions without type", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const mentionNode = $createMentionNode("@", "test-file.ts", "test-file.ts")

			expect(mentionNode.getFormattedDisplayText()).toBe("@test-file.ts")
		})
	})

	it("should keep @ prefix for special mentions (problems, terminal)", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const problemsNode = $createMentionNode("@", "problems", "problems", undefined, { type: "problems" })
			const terminalNode = $createMentionNode("@", "terminal", "terminal", undefined, { type: "terminal" })

			expect(problemsNode.getFormattedDisplayText()).toBe("@problems")
			expect(terminalNode.getFormattedDisplayText()).toBe("@terminal")
		})
	})

	it("should serialize and deserialize with value and label", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const mentionNode = $createMentionNode("@", "/path/to/filename.ts", "filename.ts", undefined, {
				type: "file",
			})
			const serialized = mentionNode.exportJSON()

			expect(serialized.value).toBe("/path/to/filename.ts")
			expect(serialized.label).toBe("filename.ts")

			const deserialized = MentionNode.importJSON(serialized)
			expect(deserialized.getValue()).toBe("/path/to/filename.ts")
			expect(deserialized.getLabel()).toBe("filename.ts")
		})
	})

	it("should update value and label", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const mentionNode = $createMentionNode("@", "file.ts", "file.ts")

			const withValue = mentionNode.setValue("/path/to/file.ts")
			expect(withValue.getValue()).toBe("/path/to/file.ts")

			const withLabel = withValue.setLabel("file.ts")
			expect(withLabel.getLabel()).toBe("file.ts")
		})
	})

	it("should update display text when setting data with type", () => {
		const editor = createEditor({ nodes: [MentionNode] })

		editor.update(() => {
			const mentionNode = $createMentionNode("@", "/path/to/file.ts", "file.ts")

			const withType = mentionNode.setData({ type: "file" })
			expect(withType.getFormattedDisplayText()).toBe("@file:file.ts")
		})
	})

	describe("Type-based prefix formatting", () => {
		it("should format 'file' type with @file: prefix", () => {
			const editor = createEditor({ nodes: [MentionNode] })

			editor.update(() => {
				const mentionNode = $createMentionNode("@", "/path/to/file.ts", "file.ts", undefined, { type: "file" })
				expect(mentionNode.getFormattedDisplayText()).toBe("@file:file.ts")
			})
		})

		it("should format 'openedFile' type with @file: prefix", () => {
			const editor = createEditor({ nodes: [MentionNode] })

			editor.update(() => {
				const mentionNode = $createMentionNode("@", "/path/to/opened.ts", "opened.ts", undefined, {
					type: "openedFile",
				})
				expect(mentionNode.getFormattedDisplayText()).toBe("@file:opened.ts")
			})
		})

		it("should format 'folder' type with @dir: prefix and trailing slash", () => {
			const editor = createEditor({ nodes: [MentionNode] })

			editor.update(() => {
				const mentionNode = $createMentionNode("@", "/path/to/folder", "folder", undefined, { type: "folder" })
				expect(mentionNode.getFormattedDisplayText()).toBe("@dir:folder/")
			})
		})

		it("should format 'git' type with @git: prefix", () => {
			const editor = createEditor({ nodes: [MentionNode] })

			editor.update(() => {
				const mentionNode = $createMentionNode("@", "abc123def456", "abc123", undefined, { type: "git" })
				expect(mentionNode.getFormattedDisplayText()).toBe("@git:abc123")
			})
		})

		it("should format 'url' type with @url: prefix", () => {
			const editor = createEditor({ nodes: [MentionNode] })

			editor.update(() => {
				const mentionNode = $createMentionNode("@", "https://example.com", "example.com", undefined, {
					type: "url",
				})
				expect(mentionNode.getFormattedDisplayText()).toBe("@url:example.com")
			})
		})

		it("should format 'problems' type with @ prefix only", () => {
			const editor = createEditor({ nodes: [MentionNode] })

			editor.update(() => {
				const mentionNode = $createMentionNode("@", "problems", "problems", undefined, { type: "problems" })
				expect(mentionNode.getFormattedDisplayText()).toBe("@problems")
			})
		})

		it("should format 'terminal' type with @ prefix only", () => {
			const editor = createEditor({ nodes: [MentionNode] })

			editor.update(() => {
				const mentionNode = $createMentionNode("@", "terminal", "terminal", undefined, { type: "terminal" })
				expect(mentionNode.getFormattedDisplayText()).toBe("@terminal")
			})
		})

		it("should format 'mode' type with / prefix", () => {
			const editor = createEditor({ nodes: [MentionNode] })

			editor.update(() => {
				const mentionNode = $createMentionNode("/", "code", "code", undefined, { type: "mode" })
				expect(mentionNode.getFormattedDisplayText()).toBe("/code")
			})
		})

		it("should format 'command' type with / prefix", () => {
			const editor = createEditor({ nodes: [MentionNode] })

			editor.update(() => {
				const mentionNode = $createMentionNode("/", "setup", "setup", undefined, { type: "command" })
				expect(mentionNode.getFormattedDisplayText()).toBe("/setup")
			})
		})

		it("should use @ prefix for unknown types", () => {
			const editor = createEditor({ nodes: [MentionNode] })

			editor.update(() => {
				const mentionNode = $createMentionNode("@", "unknown-value", "unknown-label", undefined, {
					type: "unknown-type",
				})
				expect(mentionNode.getFormattedDisplayText()).toBe("@unknown-label")
			})
		})

		it("should update prefix when type changes", () => {
			const editor = createEditor({ nodes: [MentionNode] })

			editor.update(() => {
				// Start without type
				const mentionNode = $createMentionNode("@", "/path/to/file.ts", "file.ts")
				expect(mentionNode.getFormattedDisplayText()).toBe("@file.ts")

				// Add file type
				const withFileType = mentionNode.setData({ type: "file" })
				expect(withFileType.getFormattedDisplayText()).toBe("@file:file.ts")

				// Change to folder type
				const withFolderType = withFileType.setData({ type: "folder" })
				expect(withFolderType.getFormattedDisplayText()).toBe("@dir:file.ts/")

				// Change to git type
				const withGitType = withFolderType.setData({ type: "git" })
				expect(withGitType.getFormattedDisplayText()).toBe("@git:file.ts")
			})
		})
	})
})
