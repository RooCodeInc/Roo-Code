import { memo } from "react"
import { getIconForFilePath, getIconUrlByName } from "vscode-material-icons"

interface FileIconProps {
	filePath: string
	size?: number
	className?: string
	style?: React.CSSProperties
}

const FileIcon = memo(({ filePath, size = 14, className, style }: FileIconProps) => {
	const baseUri = (window as any)?.MATERIAL_ICONS_BASE_URI || ""
	const iconName = getIconForFilePath(filePath || "")
	const src = getIconUrlByName(iconName, baseUri)

	return (
		<img
			src={src}
			alt=""
			width={size}
			height={size}
			className={className}
			style={{ display: "inline-block", verticalAlign: "text-bottom", ...style }}
		/>
	)
})

export default FileIcon
