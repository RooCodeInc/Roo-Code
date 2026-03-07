import * as vscode from "vscode"
import type { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js"

export interface StoredMcpOAuthData {
	tokens: OAuthTokens
	/** Unix ms timestamp after which the access token should be considered expired. */
	expires_at: number
	/** The client_id used to obtain these tokens (for token reuse without re-registration). */
	client_id?: string
	/** The redirect_uri used during client registration (to detect port changes). */
	redirect_uri?: string
}

/**
 * Thin wrapper around VS Code SecretStorage for persisting MCP OAuth tokens.
 * Tokens are stored per-server (keyed by host) so different servers on the
 * same host share credentials, which is the common case for multi-path APIs.
 */
export class SecretStorageService {
	private readonly _storage: vscode.SecretStorage
	private readonly _namespace = "mcp.oauth."

	constructor(context: vscode.ExtensionContext) {
		this._storage = context.secrets
	}

	private _key(serverUrl: string): string {
		return `${this._namespace}${new URL(serverUrl).host}.data`
	}

	async getOAuthData(serverUrl: string): Promise<StoredMcpOAuthData | undefined> {
		const raw = await this._storage.get(this._key(serverUrl))
		if (!raw) return undefined
		try {
			return JSON.parse(raw) as StoredMcpOAuthData
		} catch {
			return undefined
		}
	}

	async saveOAuthData(serverUrl: string, data: StoredMcpOAuthData): Promise<void> {
		await this._storage.store(this._key(serverUrl), JSON.stringify(data))
	}

	async deleteOAuthData(serverUrl: string): Promise<void> {
		await this._storage.delete(this._key(serverUrl))
	}
}
