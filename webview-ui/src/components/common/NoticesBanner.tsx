import { memo, useState, useEffect, useMemo } from "react"
import { useExtensionState } from "@src/context/ExtensionStateContext"

const NoticesBanner = () => {
	const { notices, noticesEnabled, setNoticesEnabled } = useExtensionState()
	const [currentIndex, setCurrentIndex] = useState(0)
	// Filter valid notices: only check noticesEnabled
	const validNotices = useMemo(() => {
		if (!noticesEnabled || !notices || notices.length === 0) {
			return []
		}
		return notices
	}, [notices, noticesEnabled])

	const handleClose = () => {
		setNoticesEnabled(false)
	}

	// Rotate notices every 10 seconds if there are more than 1 notice
	useEffect(() => {
		if (validNotices.length <= 1) {
			return
		}

		const interval = setInterval(() => {
			setCurrentIndex((prevIndex) => (prevIndex + 1) % validNotices.length)
		}, 10000) // 10 seconds

		return () => clearInterval(interval)
	}, [validNotices.length])

	// Reset index when notices change
	useEffect(() => {
		setCurrentIndex(0)
	}, [validNotices])

	if (validNotices.length === 0) {
		return null
	}

	const currentNotice = validNotices[currentIndex]

	return (
		<div className="relative px-4 py-2.5 bg-vscode-banner-background border-b border-vscode-panel-border text-sm leading-normal text-vscode-foreground">
			<button
				onClick={handleClose}
				className="absolute top-1.5 right-2 bg-transparent border-none text-vscode-foreground cursor-pointer text-2xl p-1 opacity-70 hover:opacity-100 transition-opacity duration-200 leading-none"
				aria-label="Close">
				×
			</button>
			{/* Notice Title */}
			{currentNotice.title && <div className="mb-0.5 font-bold">{currentNotice.title}</div>}

			{/* Notice Content */}
			{currentNotice.content && <div className="whitespace-pre-wrap">{currentNotice.content}</div>}
		</div>
	)
}

export default memo(NoticesBanner)
