import { memo } from "react"
import { removeLeadingNonAlphanumeric } from "@src/utils/removeLeadingNonAlphanumeric"
import FileIcon from "./FileIcon"

function getBasename(filepath: string): string {
	const cleaned = removeLeadingNonAlphanumeric(filepath ?? "")
	const parts = cleaned.split("/")
	return parts[parts.length - 1] || cleaned
}

interface FilePathWithIconProps {
	filePath: string
	size?: number
	className?: string
	style?: React.CSSProperties
	boldNameOnly?: boolean // if true, shows only basename bold
	label?: string
}

const FilePathWithIcon = memo(
	({ filePath, size = 14, className, style, boldNameOnly = true, label }: FilePathWithIconProps) => {
		const name = getBasename(filePath)
		return (
			<span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 8, ...style }}>
				<FileIcon filePath={filePath} size={size} />
				{boldNameOnly ? (
					<strong className="rtl">{name + "\u200E"}</strong>
				) : (
					<span className="whitespace-nowrap overflow-hidden text-ellipsis text-left rtl">
						{removeLeadingNonAlphanumeric(filePath ?? "") + "\u200E"}
					</span>
				)}
				{label && (
					<span
						className="ml-1.5 px-2 py-[2px] rounded-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] text-[11px] leading-[1.2] text-vscode-foreground">
						{label}
					</span>
				)}
			</span>
		)
	},
)

export default FilePathWithIcon
