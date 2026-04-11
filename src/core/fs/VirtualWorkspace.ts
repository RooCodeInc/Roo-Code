import { Volume, createFsFromVolume } from "memfs"
import { Union } from "unionfs"
import * as fs from "fs"

export class VirtualWorkspace {
	vol = new Volume()
	overlayFs = new Union()

	constructor() {
		this.overlayFs.use(fs)
		Reflect.apply(this.overlayFs.use, this.overlayFs, [createFsFromVolume(this.vol)])
	}

	async writeFile(path = "", content = "") {
		return new Promise((resolve, reject) => {
			this.vol.writeFile(path, content, (err) => (err ? reject(err) : resolve(true)))
		})
	}

	async readFile(path = "") {
		return new Promise((resolve, reject) => {
			this.overlayFs.readFile(path, "utf8", (err, data) => (err ? reject(err) : resolve(data)))
		})
	}

	rollback() {
		this.vol.reset()
	}

	async commitToDisk() {
		const files = this.vol.toJSON()
		const writePromises = Object.entries(files).map(([filePath, content]) => {
			if (content !== null) {
				return fs.promises.writeFile(filePath, content)
			}
			return Promise.resolve()
		})
		await Promise.all(writePromises)
		this.vol.reset()
	}
}

export const virtualWorkspace = new VirtualWorkspace()
