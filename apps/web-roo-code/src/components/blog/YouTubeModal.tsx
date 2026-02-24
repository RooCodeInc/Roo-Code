"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/modal"

/**
 * YouTube URL patterns and utilities
 */

/** Regular expression to match YouTube URLs and extract video ID */
const YOUTUBE_URL_REGEX = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i

/**
 * Regular expression to extract timestamp from YouTube URLs.
 *
 * Supports:
 * - query params: `t=123`, `t=1h2m3s`, `start=123`, `t=1:23`, `t=1:02:03`
 * - fragment params: `#t=123` (less common but seen in some links)
 */
const TIMESTAMP_REGEX = /(?:[?&#](?:t|start)=)([0-9hms:]+)/i

/**
 * Extracts the video ID from a YouTube URL
 * Supports various YouTube URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 *
 * @param url - The YouTube URL to parse
 * @returns The video ID or null if not found
 */
export function extractYouTubeVideoId(url: string): string | null {
	const match = url.match(YOUTUBE_URL_REGEX)
	return match?.[1] ?? null
}

/**
 * Parses a YouTube timestamp string to seconds
 * Supports formats like:
 * - "123" (seconds)
 * - "1h2m3s" (hours, minutes, seconds)
 * - "2m30s" (minutes and seconds)
 * - "45s" (seconds only)
 *
 * @param timestamp - The timestamp string
 * @returns The timestamp in seconds
 */
function parseTimestampToSeconds(timestamp: string): number {
	// If it's just a number, it's already in seconds
	if (/^\d+$/.test(timestamp)) {
		return parseInt(timestamp, 10)
	}

	// Parse colon-separated formats:
	// - "mm:ss"
	// - "hh:mm:ss"
	const colonMatch = timestamp.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
	if (colonMatch) {
		const a = parseInt(colonMatch[1] ?? "0", 10)
		const b = parseInt(colonMatch[2] ?? "0", 10)
		const c = colonMatch[3] ? parseInt(colonMatch[3], 10) : null

		if (c === null) return a * 60 + b
		return a * 3600 + b * 60 + c
	}

	// Parse h/m/s format
	let totalSeconds = 0
	const hours = timestamp.match(/(\d+)h/i)
	const minutes = timestamp.match(/(\d+)m/i)
	const seconds = timestamp.match(/(\d+)s/i)

	if (hours?.[1]) totalSeconds += parseInt(hours[1], 10) * 3600
	if (minutes?.[1]) totalSeconds += parseInt(minutes[1], 10) * 60
	if (seconds?.[1]) totalSeconds += parseInt(seconds[1], 10)

	return totalSeconds
}

/**
 * Extracts the start time (in seconds) from a YouTube URL
 *
 * @param url - The YouTube URL to parse
 * @returns The start time in seconds or 0 if not found
 */
export function extractYouTubeTimestamp(url: string): number {
	const match = url.match(TIMESTAMP_REGEX)
	if (!match?.[1]) return 0
	return parseTimestampToSeconds(match[1])
}

/**
 * Checks if a URL is a YouTube URL
 *
 * @param url - The URL to check
 * @returns True if the URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
	return YOUTUBE_URL_REGEX.test(url)
}

interface YouTubeModalProps {
	/** Whether the modal is open */
	open: boolean
	/** Callback when the modal open state changes */
	onOpenChange: (open: boolean) => void
	/** The YouTube video ID */
	videoId: string
	/** The start time in seconds (optional) */
	startTime?: number
	/** The video title for accessibility (optional) */
	title?: string
}

/**
 * YouTubeModal component
 *
 * A modal dialog that embeds a YouTube video player.
 * Supports starting playback at a specific timestamp.
 *
 * @example
 * ```tsx
 * <YouTubeModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   videoId="dQw4w9WgXcQ"
 *   startTime={42}
 *   title="Never Gonna Give You Up"
 * />
 * ```
 */
export function YouTubeModal({ open, onOpenChange, videoId, startTime = 0, title }: YouTubeModalProps) {
	// Build the YouTube embed URL with parameters
	const embedUrl = React.useMemo(() => {
		const params = new URLSearchParams({
			autoplay: "1",
			rel: "0", // Don't show related videos from other channels
			modestbranding: "1", // Minimal YouTube branding
		})

		if (startTime > 0) {
			params.set("start", startTime.toString())
		}

		return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
	}, [videoId, startTime])

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl w-[90vw] p-0 overflow-hidden bg-black" aria-describedby={undefined}>
				{/* Visually hidden title for accessibility */}
				<DialogTitle className="sr-only">{title ?? "YouTube Video"}</DialogTitle>
				<div className="relative w-full pt-[56.25%]">
					{/* 16:9 aspect ratio container */}
					{open && (
						<iframe
							className="absolute inset-0 w-full h-full"
							src={embedUrl}
							title={title ?? "YouTube Video"}
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowFullScreen
						/>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}

export default YouTubeModal
