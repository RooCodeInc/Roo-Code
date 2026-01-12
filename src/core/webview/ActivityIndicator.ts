import * as vscode from "vscode"
import { Package } from "../../shared/package"

/**
 * Manages the activity indicator (spinning progress icon) on the Roo Code sidebar icon.
 *
 * Uses VSCode's `window.withProgress` API with a view-specific location to show
 * a progress indicator on the activity bar icon when Roo is working on a task.
 *
 * This provides visual feedback to users even when they've navigated away from
 * the Roo Code sidebar to other views like Explorer or Source Control.
 */
export class ActivityIndicator {
	private static readonly VIEW_ID = `${Package.name}.SidebarProvider`

	private isIndicatorActive = false
	private resolveProgressPromise: (() => void) | null = null

	/**
	 * Shows the activity indicator on the sidebar icon.
	 * If already showing, this is a no-op.
	 *
	 * The indicator will continue showing until `hide()` is called.
	 */
	public show(): void {
		if (this.isIndicatorActive) {
			return
		}

		this.isIndicatorActive = true

		vscode.window.withProgress(
			{
				location: { viewId: ActivityIndicator.VIEW_ID },
				title: "Roo is working...",
			},
			() => {
				return new Promise<void>((resolve) => {
					this.resolveProgressPromise = resolve
				})
			},
		)
	}

	/**
	 * Hides the activity indicator on the sidebar icon.
	 * If not currently showing, this is a no-op.
	 */
	public hide(): void {
		if (!this.isIndicatorActive) {
			return
		}

		this.isIndicatorActive = false

		if (this.resolveProgressPromise) {
			this.resolveProgressPromise()
			this.resolveProgressPromise = null
		}
	}

	/**
	 * Returns whether the activity indicator is currently showing.
	 */
	public isActive(): boolean {
		return this.isIndicatorActive
	}

	/**
	 * Disposes the activity indicator, hiding it if active.
	 */
	public dispose(): void {
		this.hide()
	}
}
