/**
 * Modified from Kilo-Org/kilocode
 * Copyright Kilo Org, Inc.
 * Licensed under Apache-2.0
 */
import { IDE } from "../types/ide"
import { AutocompleteCodeSnippet, AutocompleteClipboardSnippet } from "./types"
import { AutocompleteSnippetType } from "./types"
import { openedFilesLruCache } from "../utils/openedFilesLruCache"
import { RecentlyEditedRange } from "../types"

export interface SnippetPayload {
	recentlyEditedRangeSnippets: AutocompleteCodeSnippet[]
	recentlyVisitedRangesSnippets: AutocompleteCodeSnippet[]
	clipboardSnippets: AutocompleteClipboardSnippet[]
	recentlyOpenedFileSnippets: AutocompleteCodeSnippet[]
}

function racePromise<T>(promise: Promise<T[]>, timeout = 100): Promise<T[]> {
	const timeoutPromise = new Promise<T[]>((resolve) => {
		setTimeout(() => resolve([]), timeout)
	})

	return Promise.race([promise, timeoutPromise])
}
const getClipboardSnippets = async (ide: IDE): Promise<AutocompleteClipboardSnippet[]> => {
	const content = await ide.getClipboardContent()

	return [content].map((item) => {
		return {
			content: item.text,
			copiedAt: item.copiedAt,
			type: AutocompleteSnippetType.Clipboard,
		}
	})
}

const getSnippetsFromRecentlyOpenedFiles = async (filepath: string, ide: IDE): Promise<AutocompleteCodeSnippet[]> => {
	try {
		const currentFileUri = `${filepath}`

		// Get all file URIs excluding the current file
		const fileUrisToRead = [...openedFilesLruCache.entriesDescending()]
			.filter(([fileUri, _]) => fileUri !== currentFileUri)
			.map(([fileUri, _]) => fileUri)

		// Create an array of promises that each read a file with timeout
		const fileReadPromises = fileUrisToRead.map((fileUri) => {
			// Create a promise that resolves to a snippet or null
			const readPromise = new Promise<AutocompleteCodeSnippet | null>((resolve) => {
				ide.readFile(fileUri)
					.then((fileContent) => {
						if (!fileContent || fileContent.trim() === "") {
							resolve(null)
							return
						}

						resolve({
							filepath: fileUri,
							content: fileContent,
							type: AutocompleteSnippetType.Code,
						})
					})
					.catch((e) => {
						console.error(`Failed to read file ${fileUri}:`, e)
						resolve(null)
					})
			})
			// Cut off at 80ms via racing promises
			return Promise.race([readPromise, new Promise<null>((resolve) => setTimeout(() => resolve(null), 80))])
		})

		// Execute all file reads in parallel
		const results = await Promise.all(fileReadPromises)

		// Filter out null results
		return results.filter(Boolean) as AutocompleteCodeSnippet[]
	} catch (e) {
		console.error("Error processing opened files cache:", e)
		return []
	}
}

const getSnippetsFromRecentlyEditedRanges = async (
	recentlyEditedRanges: RecentlyEditedRange[],
): Promise<AutocompleteCodeSnippet[]> => {
	return recentlyEditedRanges.map((range) => {
		return {
			filepath: range.filepath,
			content: range.lines.join("\n"),
			type: AutocompleteSnippetType.Code,
		} as AutocompleteCodeSnippet
	})
}

export const getAllSnippets = async ({
	recentlyEditedRanges,
	recentlyVisitedRanges,
	filepath,
	ide,
}: {
	recentlyEditedRanges: RecentlyEditedRange[]
	recentlyVisitedRanges: AutocompleteCodeSnippet[]
	filepath: string
	ide: IDE
}): Promise<SnippetPayload> => {
	const [recentlyEditedRangeSnippets, recentlyOpenedFileSnippets, clipboardSnippets] = await Promise.all([
		racePromise(getSnippetsFromRecentlyEditedRanges(recentlyEditedRanges)),
		racePromise(getSnippetsFromRecentlyOpenedFiles(filepath, ide)),
		getClipboardSnippets(ide),
	])

	return {
		recentlyEditedRangeSnippets,
		recentlyVisitedRangesSnippets: recentlyVisitedRanges,
		recentlyOpenedFileSnippets,
		clipboardSnippets,
	}
}
