export interface ICacheManager {
	getHash(filePath: string): string | undefined
	updateHash(filePath: string, hash: string): void
	deleteHash(filePath: string): void
	flush(): Promise<void>
	getAllHashes(): Record<string, string>
}
