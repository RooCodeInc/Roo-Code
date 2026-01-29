import React, { useRef } from "react"
import videos from "@site/docs/tutorial-videos.json"

interface Video {
	id: string
	title: string
}

export default function VideoGrid(): React.JSX.Element {
	const videoRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

	const scrollToVideo = (videoId: string) => {
		const element = videoRefs.current[videoId]
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "center" })
		}
	}

	return (
		<div>
			{/* Table of Contents */}
			<div
				className="video-toc"
				style={{
					marginBottom: "2rem",
					padding: "1.5rem",
					backgroundColor: "var(--ifm-background-surface-color)",
					borderRadius: "8px",
					border: "1px solid var(--ifm-color-emphasis-200)",
				}}>
				<h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Videos</h3>
				<ol
					style={{
						listStylePosition: "inside",
						paddingLeft: 0,
						marginBottom: 0,
					}}>
					{videos.videos.map((video: Video) => (
						<li
							key={`toc-${video.id}`}
							style={{
								marginBottom: "0.5rem",
								cursor: "pointer",
								color: "var(--ifm-color-primary)",
							}}>
							<a
								onClick={(e) => {
									e.preventDefault()
									scrollToVideo(video.id)
								}}
								style={{
									cursor: "pointer",
									textDecoration: "none",
									color: "inherit",
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.textDecoration = "underline"
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.textDecoration = "none"
								}}>
								{video.title}
							</a>
						</li>
					))}
				</ol>
			</div>

			{/* Video Grid */}
			<div className="video-grid">
				{videos.videos.map((video: Video) => (
					<div
						key={video.id}
						className="video-item"
						ref={(el) => {
							videoRefs.current[video.id] = el
						}}>
						<div
							className="video-container"
							onClick={(e) => {
								const target = e.currentTarget
								target.innerHTML = `<iframe src='https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1' title='${video.title}' allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture' allowFullScreen></iframe>`
							}}>
							<img
								src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`}
								alt={video.title}
								style={{
									width: "100%",
									height: "100%",
									position: "absolute",
									top: 0,
									left: 0,
									cursor: "pointer",
								}}
							/>
							<div
								style={{
									position: "absolute",
									top: "50%",
									left: "50%",
									transform: "translate(-50%,-50%)",
									width: "68px",
									height: "48px",
									background: "rgba(0,0,0,0.7)",
									borderRadius: "12px",
								}}>
								<div
									style={{
										borderStyle: "solid",
										borderWidth: "12px 0 12px 20px",
										borderColor: "transparent transparent transparent white",
										position: "absolute",
										top: "12px",
										left: "26px",
									}}
								/>
							</div>
						</div>
						<div className="video-info">
							<span className="video-title">{video.title}</span>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
