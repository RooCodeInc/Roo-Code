import React from "react"

interface Todo {
	id: string
	text: string
	completed: boolean
}

interface TodoListProps {
	todos: Todo[]
}

const TodoList: React.FC<TodoListProps> = ({ todos }) => {
	return (
		<div>
			<h1>Todo List</h1>
			{todos.length === 0 ? (
				<p>No todos yet!</p>
			) : (
				<ul>
					{todos.map((todo) => (
						<li key={todo.id} style={{ textDecoration: todo.completed ? "line-through" : "none" }}>
							{todo.text}
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

export default TodoList
