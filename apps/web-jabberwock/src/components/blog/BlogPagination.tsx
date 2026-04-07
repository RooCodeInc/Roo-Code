/**
 * Blog Pagination Component
 * Provides navigation between paginated blog listing pages
 */

import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface BlogPaginationProps {
	currentPage: number
	totalPages: number
	basePath?: string
	/** If true, use query params (?view=all&page=N) instead of path-based pagination */
	useQueryParams?: boolean
}

/**
 * Generates the URL for a given page number
 * Default: Page 1 goes to /blog, pages 2+ go to /blog/page/N
 * With useQueryParams: Uses /blog?view=all or /blog?view=all&page=N
 */
function getPageUrl(page: number, basePath: string, useQueryParams?: boolean): string {
	if (useQueryParams) {
		if (page === 1) {
			return "/blog?view=all"
		}
		return `/blog?view=all&page=${page}`
	}

	if (page === 1) {
		return basePath
	}
	return `${basePath}/page/${page}`
}

/**
 * Generates page numbers to display
 * Shows: first, last, current, and neighbors with ellipsis for gaps
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
	const pages: (number | "ellipsis")[] = []

	if (totalPages <= 7) {
		// Show all pages if 7 or fewer
		for (let i = 1; i <= totalPages; i++) {
			pages.push(i)
		}
		return pages
	}

	// Always show first page
	pages.push(1)

	// Calculate range around current page
	const leftBound = Math.max(2, currentPage - 1)
	const rightBound = Math.min(totalPages - 1, currentPage + 1)

	// Add ellipsis before range if needed
	if (leftBound > 2) {
		pages.push("ellipsis")
	}

	// Add pages in range
	for (let i = leftBound; i <= rightBound; i++) {
		pages.push(i)
	}

	// Add ellipsis after range if needed
	if (rightBound < totalPages - 1) {
		pages.push("ellipsis")
	}

	// Always show last page
	pages.push(totalPages)

	return pages
}

export function BlogPagination({ currentPage, totalPages, basePath = "/blog", useQueryParams }: BlogPaginationProps) {
	if (totalPages <= 1) {
		return null
	}

	const pageNumbers = getPageNumbers(currentPage, totalPages)
	const hasPreviousPage = currentPage > 1
	const hasNextPage = currentPage < totalPages

	return (
		<nav aria-label="Blog pagination" className="mt-12 flex items-center justify-center gap-1 sm:gap-2">
			{/* Previous button */}
			{hasPreviousPage ? (
				<Link
					href={getPageUrl(currentPage - 1, basePath, useQueryParams)}
					className={cn(
						"flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium",
						"text-muted-foreground hover:bg-muted hover:text-foreground",
						"transition-colors",
					)}
					aria-label="Go to previous page">
					<ChevronLeft className="h-4 w-4" />
					<span className="hidden sm:inline">Previous</span>
				</Link>
			) : (
				<span
					className={cn(
						"flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium",
						"cursor-not-allowed text-muted-foreground/50",
					)}
					aria-disabled="true">
					<ChevronLeft className="h-4 w-4" />
					<span className="hidden sm:inline">Previous</span>
				</span>
			)}

			{/* Page numbers */}
			<div className="flex items-center gap-1">
				{pageNumbers.map((page, index) => {
					if (page === "ellipsis") {
						return (
							<span key={`ellipsis-${index}`} className="px-2 py-2 text-sm text-muted-foreground">
								...
							</span>
						)
					}

					const isCurrentPage = page === currentPage

					if (isCurrentPage) {
						return (
							<span
								key={page}
								className={cn(
									"flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium",
									"bg-primary text-primary-foreground",
								)}
								aria-current="page">
								{page}
							</span>
						)
					}

					return (
						<Link
							key={page}
							href={getPageUrl(page, basePath, useQueryParams)}
							className={cn(
								"flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium",
								"text-muted-foreground hover:bg-muted hover:text-foreground",
								"transition-colors",
							)}
							aria-label={`Go to page ${page}`}>
							{page}
						</Link>
					)
				})}
			</div>

			{/* Next button */}
			{hasNextPage ? (
				<Link
					href={getPageUrl(currentPage + 1, basePath, useQueryParams)}
					className={cn(
						"flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium",
						"text-muted-foreground hover:bg-muted hover:text-foreground",
						"transition-colors",
					)}
					aria-label="Go to next page">
					<span className="hidden sm:inline">Next</span>
					<ChevronRight className="h-4 w-4" />
				</Link>
			) : (
				<span
					className={cn(
						"flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium",
						"cursor-not-allowed text-muted-foreground/50",
					)}
					aria-disabled="true">
					<span className="hidden sm:inline">Next</span>
					<ChevronRight className="h-4 w-4" />
				</span>
			)}
		</nav>
	)
}
