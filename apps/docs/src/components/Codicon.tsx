import React from "react"
import "@vscode/codicons/dist/codicon.css"

interface CodiconProps {
	name: string
}

export default function Codicon({ name }: CodiconProps): React.JSX.Element {
	return <i className={`codicon codicon-${name}`} aria-hidden="true" />
}
