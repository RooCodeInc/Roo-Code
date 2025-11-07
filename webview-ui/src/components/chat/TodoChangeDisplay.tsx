import { t } from "i18next"
import { ArrowRight, Check, ListChecks, SquareDashed } from "lucide-react"

type TodoStatus = "completed" | "in_progress" | "pending"

interface TodoItem {
	id?: string
	content: string
	status?: TodoStatus | string
}

interface TodoChangeDisplayProps {
	previousTodos: TodoItem[]
	newTodos: TodoItem[]
}

function getTodoIcon(status: TodoStatus | null) {
	switch (status) {
		case "completed":
			return <Check className="size-3 mt-1 shrink-0" />
		case "in_progress":
			return <ArrowRight className="size-3 mt-1 shrink-0" />
		default:
			return <SquareDashed className="size-3 mt-1 shrink-0" />
	}
}

export function TodoChangeDisplay({ previousTodos, newTodos }: TodoChangeDisplayProps) {
	// Find completed todos (were not completed, now are)
	const completedTodos = newTodos.filter((newTodo) => {
		if (newTodo.status !== "completed") return false
		const previousTodo = previousTodos.find((p) => p.id === newTodo.id || p.content === newTodo.content)
		return !previousTodo || previousTodo.status !== "completed"
	})

	// Find newly started todos (were not in_progress, now are)
	const startedTodos = newTodos.filter((newTodo) => {
		if (newTodo.status !== "in_progress") return false
		const previousTodo = previousTodos.find((p) => p.id === newTodo.id || p.content === newTodo.content)
		return !previousTodo || previousTodo.status !== "in_progress"
	})

	// If no changes, don't render anything
	if (completedTodos.length === 0 && startedTodos.length === 0) {
		return null
	}

	return (
		<div data-todo-changes className="overflow-hidden">
			<div className="flex items-center gap-2">
				<ListChecks className="size-4 shrink-0" />
				<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold">
					{t("chat:todo.updated")}
				</span>
			</div>

			<div className="pl-1 pr-1 pt-1 font-light leading-normal">
				{completedTodos.length > 0 && (
					<ul className="list-none space-y-1 my-1">
						{completedTodos.map((todo) => {
							const icon = getTodoIcon("completed")
							return (
								<li
									key={`completed-${todo.id || todo.content}`}
									className="flex flex-row gap-2 items-start">
									{icon}
									<span>{todo.content}</span>
								</li>
							)
						})}
					</ul>
				)}

				{startedTodos.length > 0 && (
					<ul className="list-none space-y-1 my-1">
						{startedTodos.map((todo) => {
							const icon = getTodoIcon("in_progress")
							return (
								<li
									key={`started-${todo.id || todo.content}`}
									className="flex flex-row gap-2 items-start text-vscode-charts-yellow">
									{icon}
									<span>{todo.content}</span>
								</li>
							)
						})}
					</ul>
				)}
			</div>
		</div>
	)
}
