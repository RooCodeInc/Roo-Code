import { describe, it, expect } from "vitest"
import { ChatStore } from "../ChatTreeStore"

describe("ChatTreeStore", () => {
	it("creates branches and switches contexts properly", () => {
		const store = ChatStore.create({
			nodes: {},
		})

		const parentNode = store.createBranch(undefined, "Root Task", "root-id")
		expect(store.nodes.size).toBe(1)
		expect(parentNode.title).toBe("Root Task")

		const childNode = store.createBranch("root-id", "Child Task", "child-id")
		expect(store.nodes.size).toBe(2)
		expect(childNode.parentId).toBe("root-id")

		const fetchedParent = store.nodes.get("root-id")
		expect(fetchedParent?.children.length).toBe(1)
		expect(fetchedParent?.children[0]).toBe("child-id")

		store.switchContext("child-id")
		expect(store.activeNodeId?.id).toBe("child-id")

		store.switchContext("root-id")
		expect(store.activeNodeId?.id).toBe("root-id")
	})
})
