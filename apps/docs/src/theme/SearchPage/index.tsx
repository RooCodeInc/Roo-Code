/* eslint-env browser */
/* Custom SearchPage override that always pushes Release Notes results to the bottom */
import React, { useCallback, useEffect, useMemo, useState } from "react"
import useDocusaurusContext from "@docusaurus/useDocusaurusContext"
import Layout from "@theme/Layout"
import Head from "@docusaurus/Head"
import Link from "@docusaurus/Link"
import { translate } from "@docusaurus/Translate"
import { usePluralForm } from "@docusaurus/theme-common"
import clsx from "clsx"

// Plugin internals (mirrors original SearchPage)
import useSearchQuery from "@easyops-cn/docusaurus-search-local/dist/client/client/theme/hooks/useSearchQuery"
import {
	fetchIndexesByWorker,
	searchByWorker,
} from "@easyops-cn/docusaurus-search-local/dist/client/client/theme/searchByWorker"
import { SearchDocumentType } from "@easyops-cn/docusaurus-search-local/dist/client/shared/interfaces"
import { highlight } from "@easyops-cn/docusaurus-search-local/dist/client/client/utils/highlight"
import { highlightStemmed } from "@easyops-cn/docusaurus-search-local/dist/client/client/utils/highlightStemmed"
import { getStemmedPositions } from "@easyops-cn/docusaurus-search-local/dist/client/client/utils/getStemmedPositions"
import LoadingRing from "@easyops-cn/docusaurus-search-local/dist/client/client/theme/LoadingRing/LoadingRing"
import { concatDocumentPath } from "@easyops-cn/docusaurus-search-local/dist/client/client/utils/concatDocumentPath"
import {
	Mark,
	searchContextByPaths,
	useAllContextsWithNoSearchContext,
} from "@easyops-cn/docusaurus-search-local/dist/client/client/utils/proxiedGenerated"
import styles from "@easyops-cn/docusaurus-search-local/dist/client/client/theme/SearchPage/SearchPage.module.css"
import { normalizeContextByPath } from "@easyops-cn/docusaurus-search-local/dist/client/client/utils/normalizeContextByPath"

// Ensure release notes always sink to bottom
function deprioritizeReleaseNotes(results: any[]) {
	if (!Array.isArray(results)) return results
	const isRN = (u: string) => typeof u === "string" && u.includes("/update-notes")
	const nonRN: any[] = []
	const rn: any[] = []
	for (const r of results) {
		const url = r?.document?.u ?? ""
		;(isRN(url) ? rn : nonRN).push(r)
	}
	return [...nonRN, ...rn]
}

export default function SearchPage() {
	return (
		<Layout>
			<SearchPageContent />
		</Layout>
	)
}

function SearchPageContent() {
	const {
		siteConfig: { baseUrl },
		i18n: { currentLocale },
	} = useDocusaurusContext()
	const { selectMessage } = usePluralForm()
	const { searchValue, searchContext, searchVersion, updateSearchPath, updateSearchContext } = useSearchQuery() as any

	const [searchQuery, setSearchQuery] = useState(searchValue)
	const [searchResults, setSearchResults] = useState<any[] | undefined>()
	const versionUrl = `${baseUrl}${searchVersion}`
	const pageTitle = useMemo(
		() =>
			searchQuery
				? translate(
						{
							id: "theme.SearchPage.existingResultsTitle",
							message: 'Search results for "{query}"',
							description: "The search page title for non-empty query",
						},
						{
							query: searchQuery,
						},
					)
				: translate({
						id: "theme.SearchPage.emptyResultsTitle",
						message: "Search the documentation",
						description: "The search page title for empty query",
					}),
		[searchQuery],
	)

	useEffect(() => {
		updateSearchPath(searchQuery)
		if (searchQuery) {
			;(async () => {
				const results = await searchByWorker(versionUrl, searchContext, searchQuery, 100)
				setSearchResults(deprioritizeReleaseNotes(results))
			})()
		} else {
			setSearchResults(undefined)
		}
		// `updateSearchPath` intentionally omitted from deps (matches plugin behavior)
	}, [searchQuery, versionUrl, searchContext])

	const handleSearchInputChange = useCallback((e: React.ChangeEvent<any>) => {
		setSearchQuery(e.target.value)
	}, [])

	useEffect(() => {
		if (searchValue && searchValue !== searchQuery) {
			setSearchQuery(searchValue)
		}
	}, [searchValue])

	const [searchWorkerReady, setSearchWorkerReady] = useState(false)
	useEffect(() => {
		async function doFetchIndexes() {
			if (!Array.isArray(searchContextByPaths) || searchContext || useAllContextsWithNoSearchContext) {
				await fetchIndexesByWorker(versionUrl, searchContext)
			}
			setSearchWorkerReady(true)
		}
		doFetchIndexes()
	}, [searchContext, versionUrl])

	return (
		<React.Fragment>
			<Head>
				{/* Do not index search pages */}
				<meta property="robots" content="noindex, follow" />
				<title>{pageTitle}</title>
			</Head>

			<div className="container margin-vert--lg">
				<h1>{pageTitle}</h1>

				<div className="row">
					<div
						className={clsx("col", {
							[styles.searchQueryColumn]: Array.isArray(searchContextByPaths),
							"col--9": Array.isArray(searchContextByPaths),
							"col--12": !Array.isArray(searchContextByPaths),
						})}>
						<input
							type="search"
							name="q"
							className={styles.searchQueryInput}
							aria-label="Search"
							onChange={handleSearchInputChange}
							value={searchQuery}
							autoComplete="off"
							autoFocus
						/>
					</div>
					{Array.isArray(searchContextByPaths) ? (
						<div className={clsx("col", "col--3", "padding-left--none", styles.searchContextColumn)}>
							<select
								name="search-context"
								className={styles.searchContextInput}
								id="context-selector"
								value={searchContext}
								onChange={(e) => updateSearchContext(e.target.value)}>
								{useAllContextsWithNoSearchContext && (
									<option value="">
										{translate({
											id: "theme.SearchPage.searchContext.everywhere",
											message: "Everywhere",
										})}
									</option>
								)}
								{searchContextByPaths.map((context: any) => {
									const { label, path } = normalizeContextByPath(context, currentLocale)
									return (
										<option key={path} value={path}>
											{label}
										</option>
									)
								})}
							</select>
						</div>
					) : null}
				</div>

				{!searchWorkerReady && searchQuery && (
					<div>
						<LoadingRing />
					</div>
				)}

				{searchResults &&
					(searchResults.length > 0 ? (
						<p>
							{selectMessage(
								searchResults.length,
								translate(
									{
										id: "theme.SearchPage.documentsFound.plurals",
										message: "1 document found|{count} documents found",
										description:
											'Pluralized label for "{count} documents found". See https://www.unicode.org/cldr/cldr-aux/charts/34/supplemental/language_plural_rules.html',
									},
									{ count: searchResults.length },
								),
							)}
						</p>
					) : process.env.NODE_ENV === "production" ? (
						<p>
							{translate({
								id: "theme.SearchPage.noResultsText",
								message: "No documents were found",
								description: "The paragraph for empty search result",
							})}
						</p>
					) : (
						<p>⚠️ The search index is only available when you run docusaurus build!</p>
					))}

				<section>
					{searchResults &&
						searchResults.map((item) => <SearchResultItem key={item.document.i} searchResult={item} />)}
				</section>
			</div>
		</React.Fragment>
	)
}

function SearchResultItem({ searchResult: { document, type, page, tokens, metadata } }: { searchResult: any }) {
	const isTitle = type === SearchDocumentType.Title
	const isKeywords = type === SearchDocumentType.Keywords
	const isDescription = type === SearchDocumentType.Description
	const isDescriptionOrKeywords = isDescription || isKeywords
	const isTitleRelated = isTitle || isDescriptionOrKeywords
	const isContent = type === SearchDocumentType.Content

	const pathItems = (isTitle ? document.b : page.b).slice()
	const articleTitle = isContent || isDescriptionOrKeywords ? document.s : document.t
	if (!isTitleRelated) {
		pathItems.push(page.t)
	}

	let search = ""
	if (Mark && tokens.length > 0) {
		const params = new window.URLSearchParams()
		for (const token of tokens) {
			params.append("_highlight", token)
		}
		search = `?${params.toString()}`
	}

	return (
		<article className={styles.searchResultItem}>
			<h2>
				<Link
					to={(document.u as string) + search + (document.h || "")}
					dangerouslySetInnerHTML={{
						__html:
							isContent || isDescriptionOrKeywords
								? highlight(articleTitle, tokens)
								: highlightStemmed(articleTitle, getStemmedPositions(metadata, "t"), tokens, 100),
					}}></Link>
			</h2>

			{pathItems.length > 0 && <p className={styles.searchResultItemPath}>{concatDocumentPath(pathItems)}</p>}

			{(isContent || isDescription) && (
				<p
					className={styles.searchResultItemSummary}
					dangerouslySetInnerHTML={{
						__html: highlightStemmed(document.t, getStemmedPositions(metadata, "t"), tokens, 100),
					}}
				/>
			)}
		</article>
	)
}
