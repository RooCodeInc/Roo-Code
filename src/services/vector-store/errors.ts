/**
 * Base class for vector-store related errors.
 */
export class VectorStoreError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "VectorStoreError"
	}
}

/**
 * Raised when an existing collection's vector dimension does not match
 * the requested one and recovery fails.
 */
export class DimensionMismatchError extends VectorStoreError {
	constructor(message: string) {
		super(message)
		this.name = "DimensionMismatchError"
	}
}

/**
 * Raised when a collection cannot be created or initialized.
 */
export class CollectionInitError extends VectorStoreError {
	constructor(message: string) {
		super(message)
		this.name = "CollectionInitError"
	}
}

/**
 * Raised when attempting to instantiate or use an unsupported provider.
 */
export class UnsupportedProviderError extends VectorStoreError {
	constructor(message: string) {
		super(message)
		this.name = "UnsupportedProviderError"
	}
}

/**
 * Raised when configuration is invalid or incomplete.
 */
export class ConfigurationError extends VectorStoreError {
	constructor(message: string) {
		super(message)
		this.name = "ConfigurationError"
	}
}
