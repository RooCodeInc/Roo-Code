import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as iconv from "iconv-lite"

/**
 * Encoding mapping from VSCode encoding names to iconv-lite encoding names.
 * VSCode uses specific encoding names that may differ from iconv-lite's names.
 *
 * @see https://code.visualstudio.com/docs/editor/codebasics#_file-encoding-support
 */
const ENCODING_MAP: Record<string, string> = {
	// UTF variants
	utf8: "utf8",
	"utf-8": "utf8",
	utf8bom: "utf8",
	"utf-8-bom": "utf8",
	utf16le: "utf16le",
	utf16be: "utf16be",

	// ISO encodings
	iso88591: "iso88591",
	iso885915: "iso885915",
	iso88592: "iso88592",
	iso88593: "iso88593",
	iso88594: "iso88594",
	iso88595: "iso88595",
	iso88596: "iso88596",
	iso88597: "iso88597",
	iso88598: "iso88598",
	iso88599: "iso88599",
	iso885910: "iso885910",
	iso885911: "iso885911",
	iso885913: "iso885913",
	iso885914: "iso885914",
	iso885916: "iso885916",

	// Windows code pages
	windows1250: "windows1250",
	windows1251: "windows1251",
	windows1252: "windows1252",
	windows1253: "windows1253",
	windows1254: "windows1254",
	windows1255: "windows1255",
	windows1256: "windows1256",
	windows1257: "windows1257",
	windows1258: "windows1258",

	// DOS code pages
	cp437: "cp437",
	cp850: "cp850",
	cp852: "cp852",
	cp855: "cp855",
	cp857: "cp857",
	cp860: "cp860",
	cp861: "cp861",
	cp862: "cp862",
	cp863: "cp863",
	cp864: "cp864",
	cp865: "cp865",
	cp866: "cp866",
	cp869: "cp869",
	cp874: "cp874",
	cp932: "cp932",
	cp936: "cp936",
	cp949: "cp949",
	cp950: "cp950",

	// KOI8 variants
	koi8r: "koi8r",
	"koi8-r": "koi8r",
	koi8u: "koi8u",
	"koi8-u": "koi8u",

	// EUC variants
	eucjp: "eucjp",
	"euc-jp": "eucjp",
	euckr: "euckr",
	"euc-kr": "euckr",
	euccn: "euccn",
	"euc-cn": "euccn",

	// Japanese
	shiftjis: "shiftjis",
	"shift-jis": "shiftjis",
	shift_jis: "shiftjis",

	// Chinese
	gb2312: "gb2312",
	gbk: "gbk",
	gb18030: "gb18030",
	big5: "big5",
	"big5-hkscs": "big5hkscs",

	// Russian
	macroman: "macroman",
	maccyrillic: "maccyrillic",
}

/**
 * Result type for encoding operations
 */
export interface EncodingResult {
	content: string
	encoding: string
	usedFallback: boolean
}

/**
 * Get the file encoding setting from VSCode workspace configuration.
 * This respects the user's `files.encoding` setting.
 *
 * @param filePath - The absolute path to the file (used for resource-scoped settings)
 * @returns The encoding name configured in VSCode settings, defaults to "utf8"
 */
export function getFileEncoding(filePath: string): string {
	const fileUri = vscode.Uri.file(filePath)
	const config = vscode.workspace.getConfiguration("files", fileUri)
	const encoding = config.get<string>("encoding", "utf8")
	return encoding
}

/**
 * Convert a VSCode encoding name to an iconv-lite compatible encoding name.
 *
 * @param vscodeEncoding - The encoding name from VSCode settings
 * @returns The iconv-lite compatible encoding name
 */
export function normalizeEncoding(vscodeEncoding: string): string {
	const normalized = vscodeEncoding.toLowerCase().replace(/-/g, "")
	return ENCODING_MAP[normalized] || ENCODING_MAP[vscodeEncoding.toLowerCase()] || vscodeEncoding
}

/**
 * Check if an encoding is supported by iconv-lite.
 *
 * @param encoding - The encoding name to check
 * @returns true if the encoding is supported
 */
export function isEncodingSupported(encoding: string): boolean {
	return iconv.encodingExists(normalizeEncoding(encoding))
}

/**
 * Read a file with the correct encoding from VSCode settings.
 * Returns the content as a UTF-8 string (for use with AI models).
 *
 * If the file's configured encoding is not supported or conversion fails,
 * falls back to UTF-8 and logs a warning.
 *
 * @param filePath - The absolute path to the file to read
 * @returns Promise containing the file content as UTF-8 string, the original encoding, and whether fallback was used
 */
export async function readFileWithEncoding(filePath: string): Promise<EncodingResult> {
	const configuredEncoding = getFileEncoding(filePath)
	const normalizedEncoding = normalizeEncoding(configuredEncoding)

	// Read the file as a buffer
	const buffer = await fs.readFile(filePath)

	// If encoding is UTF-8, just decode directly
	if (normalizedEncoding === "utf8") {
		return {
			content: buffer.toString("utf8"),
			encoding: configuredEncoding,
			usedFallback: false,
		}
	}

	// Check if the encoding is supported
	if (!iconv.encodingExists(normalizedEncoding)) {
		console.warn(
			`Encoding "${configuredEncoding}" (normalized: "${normalizedEncoding}") is not supported. Falling back to UTF-8.`,
		)
		return {
			content: buffer.toString("utf8"),
			encoding: configuredEncoding,
			usedFallback: true,
		}
	}

	// Convert from the file's encoding to UTF-8
	try {
		const content = iconv.decode(buffer, normalizedEncoding)
		return {
			content,
			encoding: configuredEncoding,
			usedFallback: false,
		}
	} catch (error) {
		console.warn(`Failed to decode file with encoding "${configuredEncoding}": ${error}. Falling back to UTF-8.`)
		return {
			content: buffer.toString("utf8"),
			encoding: configuredEncoding,
			usedFallback: true,
		}
	}
}

/**
 * Write content to a file with the correct encoding from VSCode settings.
 * The content is expected to be a UTF-8 string (from AI models) and will be
 * converted to the target encoding.
 *
 * If the file's configured encoding is not supported or conversion fails,
 * falls back to UTF-8 and logs a warning.
 *
 * @param filePath - The absolute path to the file to write
 * @param content - The content to write (as UTF-8 string)
 * @returns Promise containing the encoding used and whether fallback was used
 */
export async function writeFileWithEncoding(
	filePath: string,
	content: string,
): Promise<{ encoding: string; usedFallback: boolean }> {
	const configuredEncoding = getFileEncoding(filePath)
	const normalizedEncoding = normalizeEncoding(configuredEncoding)

	// If encoding is UTF-8, just write directly
	if (normalizedEncoding === "utf8") {
		await fs.writeFile(filePath, content, "utf8")
		return {
			encoding: configuredEncoding,
			usedFallback: false,
		}
	}

	// Check if the encoding is supported
	if (!iconv.encodingExists(normalizedEncoding)) {
		console.warn(
			`Encoding "${configuredEncoding}" (normalized: "${normalizedEncoding}") is not supported for writing. Falling back to UTF-8.`,
		)
		await fs.writeFile(filePath, content, "utf8")
		return {
			encoding: configuredEncoding,
			usedFallback: true,
		}
	}

	// Convert from UTF-8 to the target encoding
	try {
		const buffer = iconv.encode(content, normalizedEncoding)
		await fs.writeFile(filePath, buffer)
		return {
			encoding: configuredEncoding,
			usedFallback: false,
		}
	} catch (error) {
		console.warn(`Failed to encode content with encoding "${configuredEncoding}": ${error}. Falling back to UTF-8.`)
		await fs.writeFile(filePath, content, "utf8")
		return {
			encoding: configuredEncoding,
			usedFallback: true,
		}
	}
}
