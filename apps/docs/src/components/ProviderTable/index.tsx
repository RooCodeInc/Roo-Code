import React from "react"
import { useAllDocsData } from "@docusaurus/plugin-content-docs/client"
import modelProviders from "@site/docs/providers/index.json"

interface ProviderMetadata {
	id: string
	title: string
	extension: boolean
	cloud: boolean
	permalink: string
}

export default function ProviderTable(): React.JSX.Element {
	// Get all docs data to extract permalinks
	const allDocsData = useAllDocsData()
	const docsData = allDocsData["default"]

	if (!docsData) {
		return <div>Loading providers...</div>
	}

	// Get all docs from all versions (Docusaurus internal types don't expose permalink)
	const allDocs = Object.values(docsData.versions).flatMap(
		(version) => version.docs as unknown as Array<{ id: string; permalink: string }>,
	)

	// Create a map of doc IDs to permalinks
	const docPermalinks = new Map<string, string>()
	allDocs.forEach((doc) => {
		if (doc.id && doc.permalink) {
			docPermalinks.set(doc.id, doc.permalink)
		}
	})

	// Map providers from JSON with permalinks from docs
	const providers: ProviderMetadata[] = modelProviders.providers.map((provider) => ({
		id: provider.id,
		title: provider.title,
		extension: provider.extension,
		cloud: provider.cloud,
		permalink: docPermalinks.get(provider.id) || `/${provider.id}`,
	}))

	return (
		<table>
			<thead>
				<tr>
					<th align="left" style={{ minWidth: "100%" }}>
						Provider
					</th>
					<th align="center" style={{ minWidth: "14rem", textAlign: "center" }}>
						VS Code Extension
					</th>
					<th align="center" style={{ minWidth: "14rem", textAlign: "center" }}>
						Cloud Agents
					</th>
				</tr>
			</thead>
			<tbody>
				{providers.map((provider) => (
					<tr key={provider.id}>
						<td>
							<a href={provider.permalink}>{provider.title}</a>
						</td>
						<td align="center">
							{provider.extension ? (
								<>
									<img src="/ui/check.svg" className="icon" />
								</>
							) : (
								""
							)}
						</td>
						<td align="center">
							{provider.cloud ? (
								<>
									<img src="/ui/check.svg" className="icon" />
								</>
							) : (
								""
							)}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	)
}
