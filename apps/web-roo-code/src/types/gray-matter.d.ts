/**
 * Type declarations for gray-matter
 * @see https://github.com/jonschlinkert/gray-matter
 */

declare module "gray-matter" {
	interface GrayMatterFile<T = Record<string, unknown>> {
		/** The parsed frontmatter data */
		data: T
		/** The content of the file without the frontmatter */
		content: string
		/** The original input string */
		orig: string | Buffer
		/** The language of the frontmatter */
		language: string
		/** The raw frontmatter string (excluding delimiters) */
		matter: string
		/** Whether the input string is empty */
		isEmpty: boolean
		/** Alias for content */
		excerpt?: string
	}

	interface GrayMatterOption {
		/** Custom excerpt function or boolean */
		excerpt?: boolean | ((file: GrayMatterFile, options: GrayMatterOption) => void)
		/** Custom separator for excerpt */
		excerpt_separator?: string
		/** Custom engines for parsing */
		engines?: Record<string, unknown>
		/** Language to use for parsing */
		language?: string
		/** Custom delimiters */
		delimiters?: string | [string, string]
	}

	function matter<T = Record<string, unknown>>(input: string | Buffer, options?: GrayMatterOption): GrayMatterFile<T>

	export = matter
}
