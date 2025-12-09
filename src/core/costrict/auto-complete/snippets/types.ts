/**
 * Modified from Kilo-Org/kilocode
 * Copyright Kilo Org, Inc.
 * Licensed under Apache-2.0
 */
export enum AutocompleteSnippetType {
	Code = "code",
	Clipboard = "clipboard",
}

interface BaseAutocompleteSnippet {
	content: string
	type: AutocompleteSnippetType
}

export interface AutocompleteCodeSnippet extends BaseAutocompleteSnippet {
	filepath: string
	type: AutocompleteSnippetType.Code
}

export interface AutocompleteClipboardSnippet extends BaseAutocompleteSnippet {
	type: AutocompleteSnippetType.Clipboard
	copiedAt: string
}
