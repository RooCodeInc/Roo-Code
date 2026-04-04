/**
 * Blog View Toggle Component
 *
 * Toggles between curated (featured) posts and all posts view.
 * Uses URL search params for state to support SSR and sharing.
 */

"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

export type BlogView = "featured" | "all"

interface BlogViewToggleProps {
	curatedCount: number
	totalCount: number
}

export function BlogViewToggle({ curatedCount, totalCount }: BlogViewToggleProps) {
	const searchParams = useSearchParams()
	const currentView = (searchParams.get("view") as BlogView) || "featured"

	return (
		<div className="mt-6 flex items-center gap-4">
			<div className="flex rounded-lg border border-border bg-muted/50 p-1">
				<Link
					href="/blog"
					className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
						currentView === "featured"
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground"
					}`}>
					Featured
					<span className="ml-1.5 text-xs text-muted-foreground">({curatedCount})</span>
				</Link>
				<Link
					href="/blog?view=all"
					className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
						currentView === "all"
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground"
					}`}>
					All Posts
					<span className="ml-1.5 text-xs text-muted-foreground">({totalCount})</span>
				</Link>
			</div>
		</div>
	)
}

/**
 * Get the current blog view from search params
 */
export function getBlogView(searchParams: URLSearchParams): BlogView {
	const view = searchParams.get("view")
	return view === "all" ? "all" : "featured"
}
