/**
 * Modified from Kilo-Org/kilocode
 * Copyright Kilo Org, Inc.
 * Licensed under Apache-2.0
 */
export interface Position {
	line: number
	character: number
}
export interface Location {
	filepath: string
	position: Position
}

export interface Range {
	start: Position
	end: Position
}

export interface RangeInFile {
	filepath: string
	range: Range
}

// See https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#symbolKind.
// We shift this one index down to match vscode.SymbolKind.
export enum SymbolKind {
	File = 0,
	Module = 1,
	Namespace = 2,
	Package = 3,
	Class = 4,
	Method = 5,
	Property = 6,
	Field = 7,
	Constructor = 8,
	Enum = 9,
	Interface = 10,
	Function = 11,
	Variable = 12,
	Constant = 13,
	String = 14,
	Number = 15,
	Boolean = 16,
	Array = 17,
	Object = 18,
	Key = 19,
	Null = 20,
	EnumMember = 21,
	Struct = 22,
	Event = 23,
	Operator = 24,
	TypeParameter = 25,
}

// See https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#symbolTag.
export type SymbolTag = 1

// See https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#documentSymbol.
export interface DocumentSymbol {
	name: string
	detail?: string
	kind: SymbolKind
	tags?: SymbolTag[]
	deprecated?: boolean
	range: Range
	selectionRange: Range
	children?: DocumentSymbol[]
}

export interface FileStats {
	size: number
	lastModified: number
}

/** Map of file name to stats */
export type FileStatsMap = {
	[path: string]: FileStats
}

export type IdeType = "vscode" | "jetbrains"

export interface IdeInfo {
	ideType: IdeType
}

export interface IDE {
	getIdeInfo(): Promise<IdeInfo>

	getClipboardContent(): Promise<{ text: string; copiedAt: string }>

	getUniqueId(): Promise<string>

	getWorkspaceDirs(): Promise<string[]>

	fileExists(fileUri: string): Promise<boolean>

	writeFile(path: string, contents: string): Promise<void>

	saveFile(fileUri: string): Promise<void>

	readFile(fileUri: string): Promise<string>

	readRangeInFile(fileUri: string, range: Range): Promise<string>

	getOpenFiles(): Promise<string[]>

	getCurrentFile(): Promise<
		| undefined
		| {
				isUntitled: boolean
				path: string
				contents: string
		  }
	>

	getFileStats(files: string[]): Promise<FileStatsMap>

	// LSP
	// gotoDefinition(location: Location): Promise<RangeInFile[]>
	// gotoTypeDefinition(location: Location): Promise<RangeInFile[]> // TODO: add to jetbrains
	// getSignatureHelp(location: Location): Promise<SignatureHelp | null> // TODO: add to jetbrains
	// getReferences(location: Location): Promise<RangeInFile[]>
	// getDocumentSymbols(textDocumentIdentifier: string): Promise<DocumentSymbol[]>

	// Callbacks
	onDidChangeActiveTextEditor(callback: (fileUri: string) => void): void
}
