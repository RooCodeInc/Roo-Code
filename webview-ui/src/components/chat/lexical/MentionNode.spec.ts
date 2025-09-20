import { describe, it, expect } from "vitest"
import { $createMentionNode, $isMentionNode, MentionNode } from "./MentionNode"

describe("MentionNode", () => {
	it("should create a mention node with correct properties", () => {
		const mentionNode = $createMentionNode("test-file.ts", "@")

		expect($isMentionNode(mentionNode)).toBe(true)
		expect(mentionNode.getMentionName()).toBe("test-file.ts")
		expect(mentionNode.getTrigger()).toBe("@")
		expect(mentionNode.getTextContent()).toBe("@test-file.ts")
	})

	it("should create a command mention node", () => {
		const mentionNode = $createMentionNode("code", "/")

		expect($isMentionNode(mentionNode)).toBe(true)
		expect(mentionNode.getMentionName()).toBe("code")
		expect(mentionNode.getTrigger()).toBe("/")
		expect(mentionNode.getTextContent()).toBe("/code")
	})

	it("should serialize and deserialize correctly", () => {
		const mentionNode = $createMentionNode("test-file.ts", "@", undefined, { id: "123" })
		const serialized = mentionNode.exportJSON()

		expect(serialized.mentionName).toBe("test-file.ts")
		expect(serialized.trigger).toBe("@")
		expect(serialized.data).toEqual({ id: "123" })
		expect(serialized.type).toBe("mention")

		const deserialized = MentionNode.importJSON(serialized)
		expect(deserialized.getMentionName()).toBe("test-file.ts")
		expect(deserialized.getTrigger()).toBe("@")
		expect(deserialized.getData()).toEqual({ id: "123" })
	})

	it("should clone correctly", () => {
		const original = $createMentionNode("test-file.ts", "@", undefined, { id: "123" })
		const cloned = MentionNode.clone(original)

		expect(cloned.getMentionName()).toBe(original.getMentionName())
		expect(cloned.getTrigger()).toBe(original.getTrigger())
		expect(cloned.getData()).toEqual(original.getData())
		expect(cloned.getTextContent()).toBe(original.getTextContent())
	})

	it("should update mention name correctly", () => {
		const mentionNode = $createMentionNode("old-file.ts", "@")
		const updated = mentionNode.setMentionName("new-file.ts")

		expect(updated.getMentionName()).toBe("new-file.ts")
		expect(updated.getTextContent()).toBe("@new-file.ts")
	})

	it("should not allow text insertion before or after", () => {
		const mentionNode = $createMentionNode("test-file.ts", "@")

		expect(mentionNode.canInsertTextBefore()).toBe(false)
		expect(mentionNode.canInsertTextAfter()).toBe(false)
	})

	it("should be a text entity", () => {
		const mentionNode = $createMentionNode("test-file.ts", "@")

		expect(mentionNode.isTextEntity()).toBe(true)
	})
})
