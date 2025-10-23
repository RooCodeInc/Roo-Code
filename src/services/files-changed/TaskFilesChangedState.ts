import { FilesChangedManager } from "./FilesChangedManager"

export class TaskFilesChangedState {
	private manager?: FilesChangedManager
	private queuedChildUris = new Set<string>()
	private waitingForCheckpoint = false

	public getManager(): FilesChangedManager | undefined {
		return this.manager
	}

	public ensureManager(): FilesChangedManager {
		if (!this.manager) {
			this.manager = new FilesChangedManager("HEAD")
		}
		return this.manager
	}

	public dispose(): void {
		this.manager?.dispose()
		this.manager = undefined
		this.queuedChildUris.clear()
		this.waitingForCheckpoint = false
	}

	public collectCurrentFileUris(): string[] {
		if (!this.manager) {
			return []
		}
		return this.manager.getChanges().files.map((file) => file.uri)
	}

	public queueChildUris(uris: string[]): void {
		if (uris.length === 0) {
			return
		}
		for (const uri of uris) {
			this.queuedChildUris.add(uri)
		}
	}

	public hasQueuedChildUris(): boolean {
		return this.queuedChildUris.size > 0
	}

	public takeQueuedChildUris(): string[] {
		if (this.queuedChildUris.size === 0) {
			return []
		}
		const uris = Array.from(this.queuedChildUris)
		this.queuedChildUris.clear()
		return uris
	}

	public clearQueuedChildUris(): void {
		this.queuedChildUris.clear()
	}

	public cloneFrom(source: TaskFilesChangedState): void {
		if (source === this) {
			return
		}

		const sourceManager = source.getManager()
		if (sourceManager) {
			const changes = sourceManager.getChanges()
			this.manager?.dispose()
			this.manager = new FilesChangedManager(changes.baseCheckpoint ?? "HEAD")
			for (const fileChange of changes.files) {
				this.manager.upsertFile({ ...fileChange })
			}
		} else {
			this.manager?.dispose()
			this.manager = undefined
		}

		this.queuedChildUris = new Set(source.queuedChildUris)
		this.waitingForCheckpoint = source.waitingForCheckpoint
	}

	public setWaiting(waiting: boolean): void {
		this.waitingForCheckpoint = waiting
	}

	public isWaiting(): boolean {
		return this.waitingForCheckpoint
	}

	public shouldWaitForNextCheckpoint(): boolean {
		return this.waitingForCheckpoint
	}
}
