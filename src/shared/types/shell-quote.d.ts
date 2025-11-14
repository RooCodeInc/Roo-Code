declare module "shell-quote" {
	type ShellQuoteToken = string | { op: string } | { comment: string }

	export function parse(
		input: string,
		env?: Record<string, unknown>,
		options?: Record<string, unknown>,
	): ShellQuoteToken[]
}
