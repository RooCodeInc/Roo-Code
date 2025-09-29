/* eslint-env browser */
/* eslint-disable react-hooks/rules-of-hooks */
/* Custom SearchBar override that always pushes Release Notes suggestions to the bottom */
import React, { useCallback, useEffect, useRef, useState } from "react"
import clsx from "clsx"
import useDocusaurusContext from "@docusaurus/useDocusaurusContext"
import useIsBrowser from "@docusaurus/useIsBrowser"
import { useHistory, useLocation } from "@docusaurus/router"
import { translate } from "@docusaurus/Translate"

// Reuse plugin internals
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {
	fetchIndexesByWorker,
	searchByWorker,
} from "@easyops-cn/docusaurus-search-local/dist/client/client/theme/searchByWorker"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { SuggestionTemplate } from "@easyops-cn/docusaurus-search-local/dist/client/client/theme/SearchBar/SuggestionTemplate"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { EmptyTemplate } from "@easyops-cn/docusaurus-search-local/dist/client/client/theme/SearchBar/EmptyTemplate"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {
	Mark,
	searchBarShortcut,
	searchBarShortcutHint,
	searchBarPosition,
	searchContextByPaths,
	hideSearchBarWithNoSearchContext,
	useAllContextsWithNoSearchContext,
} from "@easyops-cn/docusaurus-search-local/dist/client/client/utils/proxiedGenerated"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { normalizeContextByPath } from "@easyops-cn/docusaurus-search-local/dist/client/client/utils/normalizeContextByPath"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { searchResultLimits } from "@easyops-cn/docusaurus-search-local/dist/client/client/utils/proxiedGeneratedConstants"

// Local fallback styles to minimize layout drift if plugin CSS path changes.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import styles from "@easyops-cn/docusaurus-search-local/dist/client/client/theme/SearchBar/SearchBar.module.css"

async function fetchAutoCompleteJS() {
	const autoCompleteModule = await import("@easyops-cn/autocomplete.js")
	const autoComplete = autoCompleteModule.default as any
	if ((autoComplete as any).noConflict) {
		;(autoComplete as any).noConflict()
	} else if ((autoCompleteModule as any).noConflict) {
		;(autoCompleteModule as any).noConflict()
	}
	return autoComplete
}

const SEARCH_PARAM_HIGHLIGHT = "_highlight"

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

export default function SearchBar(): JSX.Element {
	const isBrowser = useIsBrowser()
	const {
		siteConfig: { baseUrl },
		i18n: { currentLocale },
	} = useDocusaurusContext()

	const versionUrl = baseUrl

	const history = useHistory()
	const location = useLocation()
	const searchBarRef = useRef<any>(null)
	const indexStateMap = useRef<Map<string, "loading" | "done">>(new Map())

	const focusAfterIndexLoaded = useRef(false)
	const [loading, setLoading] = useState(false)
	const [inputChanged, setInputChanged] = useState(false)
	const [inputValue, setInputValue] = useState("")

	const search = useRef<any>(null)
	const prevSearchContext = useRef("")
	const [searchContext, setSearchContext] = useState("")
	const prevVersionUrl = useRef(baseUrl)

	useEffect(() => {
		if (!Array.isArray(searchContextByPaths)) {
			if (prevVersionUrl.current !== versionUrl) {
				indexStateMap.current.delete("")
				prevVersionUrl.current = versionUrl
			}
			return
		}
		let nextSearchContext = ""
		if (location.pathname.startsWith(versionUrl)) {
			const uri = location.pathname.substring(versionUrl.length)
			let matchedPath: string | undefined
			for (const _path of searchContextByPaths as any[]) {
				const path = typeof _path === "string" ? _path : _path.path
				if (uri === path || uri.startsWith(`${path}/`)) {
					matchedPath = path
					break
				}
			}
			if (matchedPath) {
				nextSearchContext = matchedPath
			}
		}
		if (prevSearchContext.current !== nextSearchContext) {
			indexStateMap.current.delete(nextSearchContext)
			prevSearchContext.current = nextSearchContext
		}
		setSearchContext(nextSearchContext)
	}, [location.pathname, versionUrl])

	const hidden = !!hideSearchBarWithNoSearchContext && Array.isArray(searchContextByPaths) && searchContext === ""

	const loadIndex = useCallback(async () => {
		if (hidden || indexStateMap.current.get(searchContext)) {
			return
		}
		indexStateMap.current.set(searchContext, "loading")
		search.current?.autocomplete.destroy()
		setLoading(true)
		const [autoComplete] = await Promise.all([
			fetchAutoCompleteJS(),
			fetchIndexesByWorker(versionUrl, searchContext),
		])
		const searchFooterLinkElement = ({ query, isEmpty }: { query: string; isEmpty: boolean }) => {
			const a = document.createElement("a")
			const params = new window.URLSearchParams()
			params.set("q", query)
			let linkText: string
			if (searchContext) {
				const detailedSearchContext =
					searchContext &&
					Array.isArray(searchContextByPaths) &&
					(searchContextByPaths as any[]).find((item) =>
						typeof item === "string" ? item === searchContext : item.path === searchContext,
					)
				const translatedSearchContext = detailedSearchContext
					? normalizeContextByPath(detailedSearchContext, currentLocale).label
					: searchContext
				if (useAllContextsWithNoSearchContext && isEmpty) {
					linkText = translate(
						{
							id: "theme.SearchBar.seeAllOutsideContext",
							message: 'See all results outside "{context}"',
						},
						{ context: translatedSearchContext },
					)
				} else {
					linkText = translate(
						{
							id: "theme.SearchBar.searchInContext",
							message: 'See all results within "{context}"',
						},
						{ context: translatedSearchContext },
					)
				}
			} else {
				linkText = translate({
					id: "theme.SearchBar.seeAll",
					message: "See all results",
				})
			}
			if (
				searchContext &&
				Array.isArray(searchContextByPaths) &&
				(!useAllContextsWithNoSearchContext || !isEmpty)
			) {
				params.set("ctx", searchContext)
			}
			if (versionUrl !== baseUrl) {
				if (!versionUrl.startsWith(baseUrl)) {
					throw new Error(`Version url '${versionUrl}' does not start with base url '${baseUrl}'`)
				}
				params.set("version", versionUrl.substring(baseUrl.length))
			}
			const url = `${baseUrl}search/?${params.toString()}`
			a.href = url
			a.textContent = linkText
			a.addEventListener("click", (e) => {
				if (!e.ctrlKey && !e.metaKey) {
					e.preventDefault()
					search.current?.autocomplete.close()
					history.push(url)
				}
			})
			return a
		}

		search.current = (autoComplete as any)(
			searchBarRef.current,
			{
				hint: false,
				autoselect: true,
				openOnFocus: true,
				cssClasses: {
					root: clsx(styles.searchBar, {
						[styles.searchBarLeft]: searchBarPosition === "left",
					}),
					noPrefix: true,
					dropdownMenu: styles.dropdownMenu,
					input: styles.input,
					hint: styles.hint,
					suggestions: styles.suggestions,
					suggestion: styles.suggestion,
					cursor: styles.cursor,
					dataset: styles.dataset,
					empty: styles.empty,
				},
			},
			[
				{
					source: async (input: string, callback: (res: any[]) => void) => {
						const expandedLimit = Math.max(50, (searchResultLimits as any) * 5)
						const result = await searchByWorker(versionUrl, searchContext, input, expandedLimit)
						const adjusted = deprioritizeReleaseNotes(result).slice(0, searchResultLimits as any)
						callback(adjusted)
					},
					templates: {
						suggestion: SuggestionTemplate as any,
						empty: EmptyTemplate as any,
						footer: ({ query, isEmpty }: { query: string; isEmpty: boolean }) => {
							if (isEmpty && (!searchContext || !useAllContextsWithNoSearchContext)) {
								return
							}
							const a = searchFooterLinkElement({ query, isEmpty })
							const div = document.createElement("div")
							div.className = styles.hitFooter
							div.appendChild(a)
							return div
						},
					},
				},
			],
		)
			.on("autocomplete:selected", function (_event: any, { document: { u, h }, tokens }: any) {
				searchBarRef.current?.blur()
				let url = u
				if (Mark && tokens.length > 0) {
					const params = new window.URLSearchParams()
					for (const token of tokens) {
						params.append(SEARCH_PARAM_HIGHLIGHT, token)
					}
					url += `?${params.toString()}`
				}
				if (h) {
					url += h
				}
				history.push(url)
			})
			.on("autocomplete:closed", () => {
				searchBarRef.current?.blur()
			})

		indexStateMap.current.set(searchContext, "done")
		setLoading(false)

		if (focusAfterIndexLoaded.current) {
			const input = searchBarRef.current!
			if ((input as any).value) {
				search.current?.autocomplete.open()
			}
			input.focus()
		}
	}, [hidden, searchContext, versionUrl, baseUrl, history, currentLocale])

	useEffect(() => {
		if (!Mark) return
		const keywords = isBrowser ? new window.URLSearchParams(location.search).getAll(SEARCH_PARAM_HIGHLIGHT) : []
		setTimeout(() => {
			const root = document.querySelector("article")
			if (!root) return
			// @ts-ignore
			const mark = new Mark(root)
			mark.unmark()
			if (keywords.length !== 0) {
				mark.mark(keywords, { exclude: [".theme-doc-toc-mobile > button"] })
			}
			setInputValue(keywords.join(" "))
			search.current?.autocomplete.setVal(keywords.join(" "))
		})
	}, [isBrowser, location.search, location.pathname])

	const [focused, setFocused] = useState(false)
	const onInputFocus = useCallback(() => {
		focusAfterIndexLoaded.current = true
		loadIndex()
		setFocused(true)
	}, [loadIndex])
	const onInputBlur = useCallback(() => {
		setFocused(false)
	}, [])
	const onInputMouseEnter = useCallback(() => {
		loadIndex()
	}, [loadIndex])
	const onInputChange = useCallback((event: React.ChangeEvent<any>) => {
		setInputValue(event.target.value)
		if (event.target.value) {
			setInputChanged(true)
		}
	}, [])

	const isMac = isBrowser
		? /mac/i.test((navigator as any).userAgentData?.platform ?? (navigator as any).platform)
		: false

	useEffect(() => {
		const searchBar = searchBarRef.current as any
		const domValue = searchBar?.value
		if (domValue) {
			setInputValue(domValue)
		}
		if (searchBar && document.activeElement === searchBar) {
			focusAfterIndexLoaded.current = true
			loadIndex()
			setFocused(true)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		if (!searchBarShortcut) {
			return
		}
		const handleShortcut = (event: any) => {
			if ((isMac ? event.metaKey : event.ctrlKey) && (event.key === "k" || event.key === "K")) {
				event.preventDefault()
				searchBarRef.current?.focus()
				onInputFocus()
			}
		}
		document.addEventListener("keydown", handleShortcut)
		return () => {
			document.removeEventListener("keydown", handleShortcut)
		}
	}, [isMac, onInputFocus])

	const onClearSearch = useCallback(() => {
		const params = new window.URLSearchParams(location.search)
		params.delete(SEARCH_PARAM_HIGHLIGHT)
		const paramsStr = params.toString()
		const searchUrl = location.pathname + (paramsStr !== "" ? `?${paramsStr}` : "") + location.hash
		if (searchUrl !== location.pathname + location.search + location.hash) {
			history.push(searchUrl)
		}
		setInputValue("")
		search.current?.autocomplete.setVal("")
	}, [location.pathname, location.search, location.hash, history])

	return (
		<div
			className={clsx("navbar__search", styles.searchBarContainer, {
				[styles.searchIndexLoading]: loading && inputChanged,
				[styles.focused]: focused,
			})}
			hidden={hidden}
			dir="ltr">
			<input
				placeholder={translate({
					id: "theme.SearchBar.label",
					message: "Search",
					description: "The ARIA label and placeholder for search button",
				})}
				aria-label="Search"
				className={`navbar__search-input ${styles.searchInput}`}
				onMouseEnter={onInputMouseEnter}
				onFocus={onInputFocus}
				onBlur={onInputBlur}
				onChange={onInputChange}
				ref={searchBarRef}
				value={inputValue}
			/>
			<div className={styles.searchBarLoadingRing} />
			{searchBarShortcut &&
				searchBarShortcutHint &&
				(inputValue !== "" ? (
					<button className={styles.searchClearButton} onClick={onClearSearch}>
						✕
					</button>
				) : (
					isBrowser && (
						<div className={styles.searchHintContainer}>
							<kbd className={styles.searchHint}>{isMac ? "⌘" : "ctrl"}</kbd>
							<kbd className={styles.searchHint}>K</kbd>
						</div>
					)
				))}
		</div>
	)
}
