import * as fs from "fs/promises"
import { PathLike } from "fs"

// Make a path take a unix-like form.  Useful for making path comparisons.
export function toPosix(filePath: PathLike | fs.FileHandle) {
	return filePath.toString().toPosix()
}

// Fixed version of toPosix function to avoid calling non-existent toPosix method
export function toPosixFixed(filePath: PathLike | fs.FileHandle): string {
	return filePath.toString().replace(/\\/g, "/")
}
