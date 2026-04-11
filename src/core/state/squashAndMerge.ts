import { ChatStore } from "./ChatTreeStore"
import { buildApiHandler } from "../../api"

export const squashAndMergeBranch = async (
	branchId = "",
	parentId = "",
	store = ChatStore.create({ nodes: {} }),
	apiConfiguration = JSON.parse("{}"),
) => {
	const branch = store.nodes.get(branchId)
	const parent = store.nodes.get(parentId)

	if (branch && parent) {
		const handler = buildApiHandler(apiConfiguration)
		const systemPrompt =
			"Сформируй краткий технический отчет о проделанной работе: измененные файлы, новые зависимости. Исключи логи ошибок и процесс рассуждения."
		const messages = branch.messages.map((msg) => ({
			role: msg.role === "assistant" ? "assistant" : "user",
			content: msg.content || "",
		}))

		let summary = ""
		try {
			const stream = Reflect.apply(handler.createMessage, handler, [systemPrompt, messages])
			for await (const chunk of stream) {
				if (chunk.text) {
					summary += chunk.text
				}
			}
		} catch (e) {
			summary = "Ошибка формирования отчета: " + String(e)
		}

		parent.messages.push({
			id: Date.now().toString() + Math.random().toString(36).substring(2),
			role: "system",
			content: `Отчёт субагента: \n${summary}`,
		})

		store.switchContext(parentId)
	}
}
