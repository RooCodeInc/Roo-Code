import { types } from "mobx-state-tree"
import { virtualWorkspace } from "../fs/VirtualWorkspace"

export const Message = types.model("Message", {
	id: types.identifier,
	role: types.string,
	content: types.frozen(), // Use frozen to support complex Anthropic content blocks
	ts: types.optional(types.number, () => Date.now()),
})

export const TaskNode = types
	.model("TaskNode", {
		id: types.identifier,
		title: types.string,
		mode: types.maybe(types.string), // Track the agent role for this node
		status: types.optional(types.enumeration(["pending", "in_progress", "completed", "failed"]), "pending"),
		messages: types.array(Message),
		children: types.array(types.string),
		parentId: types.maybe(types.string),
	})
	.actions((self) => ({
		addMessage(msg: { id: string; role: string; content: any; ts?: number }) {
			self.messages.push(msg)
		},
		updateStatus(status: "pending" | "in_progress" | "completed" | "failed") {
			self.status = status
		},
		setMode(mode: string) {
			self.mode = mode
		},
		addChild(childId: string) {
			self.children.push(childId)
		},
	}))

export const ChatStore = types
	.model("ChatStore", {
		nodes: types.map(TaskNode),
		activeNodeId: types.maybe(types.reference(TaskNode)),
	})
	.actions((self) => ({
		createBranch(parentId = "", title = "", id = "") {
			const node = TaskNode.create({
				id,
				title,
				parentId: parentId || undefined,
				messages: [],
				children: [],
			})

			self.nodes.put(node)

			if (parentId && self.nodes.has(parentId)) {
				const parentNode = self.nodes.get(parentId)
				if (parentNode) {
					parentNode.addChild(node.id)
				}
			}

			return node
		},
		switchContext(nodeId = "") {
			if (self.nodes.has(nodeId)) {
				const node = self.nodes.get(nodeId)
				if (node) {
					self.activeNodeId = node
				}
			}
		},
		updateNodeStatus(nodeId = "", newStatus = "pending") {
			const node = self.nodes.get(nodeId)
			if (node) {
				node.status = newStatus
				if (newStatus === "failed") {
					virtualWorkspace.rollback()
				} else if (newStatus === "completed") {
					void virtualWorkspace.commitToDisk()
				}
			}
		},
	}))
