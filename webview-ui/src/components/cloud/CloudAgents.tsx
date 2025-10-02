import React, { useEffect, useState } from "react"
import { Brain, Plus } from "lucide-react"
import type { CloudAgent } from "@roo-code/types"

interface CloudAgentsProps {
	cloudApiUrl: string
	sessionToken?: string
}

const CloudAgents: React.FC<CloudAgentsProps> = ({ cloudApiUrl, sessionToken }) => {
	const [agents, setAgents] = useState<CloudAgent[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(false)

	useEffect(() => {
		const fetchAgents = async () => {
			try {
				setLoading(true)
				setError(false)

				if (!sessionToken) {
					// Use mock data if no session token
					const mockAgents: CloudAgent[] = [
						{ id: "1", name: "Rooviewer", type: "PR Review" },
						{ id: "2", name: "Gertroode", type: "Documentation Writer" },
						{ id: "3", name: "Polyglot", type: "String Translator" },
					]
					setAgents(mockAgents)
					return
				}

				const response = await fetch(`${cloudApiUrl}/api/cloud_agents`, {
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${sessionToken}`,
					},
				})

				if (!response.ok) {
					throw new Error("Failed to fetch agents")
				}

				const data = await response.json()
				setAgents(data.agents || [])
			} catch (err) {
				console.error("Failed to fetch cloud agents, using mock data:", err)
				// Use mock data on error
				const mockAgents: CloudAgent[] = [
					{ id: "1", name: "Code Assistant", type: "code" },
					{ id: "2", name: "Test Generator", type: "test" },
					{ id: "3", name: "Code Reviewer", type: "review" },
					{ id: "4", name: "Documentation Writer", type: "docs" },
				]
				setAgents(mockAgents)
			} finally {
				setLoading(false)
			}
		}

		fetchAgents()
	}, [cloudApiUrl, sessionToken])

	// If there's an error, show nothing as requested
	if (error) {
		return null
	}

	// Don't show loading state, just render nothing until data is ready
	if (loading) {
		return null
	}

	const handleAgentClick = (agentId: string) => {
		window.open(`${cloudApiUrl}/cloud-agents/${agentId}`, "_blank")
	}

	const handleCreateClick = () => {
		window.open(`${cloudApiUrl}/cloud-agents/create`, "_blank")
	}

	return (
		<div className="flex flex-col gap-3 mt-6 w-full">
			<div className="flex flex-wrap items-center justify-between mt-4 mb-1">
				<h2 className="font-semibold text-lg shrink-0 m-0">Cloud Agents</h2>
				{agents.length > 0 && (
					<button
						onClick={handleCreateClick}
						className="text-base flex items-center gap-1 text-vscode-descriptionForeground hover:text-vscode-textLink-foreground transition-colors cursor-pointer"
						title="Create new agent">
						<Plus className="h-4 w-4" />
						Create
					</button>
				)}
			</div>

			{agents.length === 0 ? (
				<div className="items-center gap-3 px-4 py-1 rounded-xl bg-vscode-editor-background">
					<p className="text-base text-vscode-descriptionForeground mb-4">
						No Cloud agents yes?
						<button
							className="inline-flex ml-1 cursor-pointer text-vscode-textLink-foreground hover:underline"
							onClick={handleCreateClick}>
							Create your first.
						</button>
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-1">
					{agents.map((agent) => (
						<div
							key={agent.id}
							className="flex items-center gap-3 px-4 py-2 rounded-xl bg-vscode-editor-background hover:bg-vscode-list-hoverBackground cursor-pointer transition-colors"
							onClick={() => handleAgentClick(agent.id)}>
							<span className="text-xl" role="img" aria-label={agent.type}>
								<Brain className="size-6" />
							</span>
							<div className="flex-1 min-w-0">
								<div className="text-base font-medium text-vscode-foreground truncate">
									{agent.name}
								</div>
								<div className="text-sm font-light text-vscode-descriptionForeground">
									{agent.type} agents
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export default CloudAgents
