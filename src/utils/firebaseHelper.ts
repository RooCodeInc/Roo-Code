/**
 * Firebase Service API Helper
 *
 * This module provides a convenient wrapper around the Firebase Service extension API.
 * It uses the exported API instead of command-based communication for better performance
 * and type safety.
 */

import * as vscode from "vscode"
import { createOutputChannelLogger } from "./outputChannelLogger"

// Firebase Service extension ID
const FIREBASE_SERVICE_EXTENSION_ID = "ConscendoTechInc.firebase-service"

// Cache for the Firebase API instance
let cachedFirebaseAPI: any = null

/**
 * Get the Firebase Service API
 * @param outputChannel Optional output channel for logging
 * @returns Firebase API object or null if extension not available
 */
export async function getFirebaseAPI(outputChannel?: vscode.OutputChannel): Promise<any | null> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	// Return cached instance if available
	if (cachedFirebaseAPI) {
		log("Returning cached Firebase API instance")
		return cachedFirebaseAPI
	}

	try {
		log("Attempting to get Firebase Service extension")
		// Get the Firebase Service extension
		const firebaseExt = vscode.extensions.getExtension(FIREBASE_SERVICE_EXTENSION_ID)

		if (!firebaseExt) {
			log("Firebase Service extension not found")
			return null
		}

		log("Firebase Service extension found, checking if active")
		// Activate the extension if not already activated
		if (!firebaseExt.isActive) {
			log("Activating Firebase Service extension")
			await firebaseExt.activate()
			// Small delay to ensure exports are set
			await new Promise((resolve) => setTimeout(resolve, 100))
		}

		// Check if exports are available
		if (!firebaseExt.exports) {
			log("Firebase Service extension exports not available")
			return null
		}

		// The extension now exports the API object directly
		const firebaseAPI = firebaseExt.exports

		// Verify it has the expected methods
		if (!firebaseAPI.signIn || !firebaseAPI.signOut || !firebaseAPI.getCurrentUser) {
			log("Firebase API missing expected methods")
			return null
		}

		log("Firebase API successfully loaded and cached")
		// Cache the API instance
		cachedFirebaseAPI = firebaseAPI

		return firebaseAPI
	} catch (error) {
		log("Error getting Firebase API:", error)
		return null
	}
}

/**
 * Check if user is authenticated
 * @param outputChannel Optional output channel for logging
 * @returns true if authenticated, false otherwise
 */
export async function isAuthenticated(outputChannel?: vscode.OutputChannel): Promise<boolean> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		// Check for dev bypass mode first
		const context = (global as any).__rooCodeExtensionContext as vscode.ExtensionContext | undefined
		if (context) {
			const devBypassActive = context.globalState.get<boolean>("devBypassActive")
			if (devBypassActive) {
				return true
			}
		}

		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for authentication check")
			return false
		}

		// Log available methods for debugging
		const methods = Object.keys(api)
		log("Available Firebase API methods:", methods)

		// Check if the API has isAuthenticated method
		if (typeof api.isAuthenticated !== "function") {
			log("isAuthenticated method not available, trying getCurrentSession")
			// Try getCurrentSession as an alternative
			if (typeof api.getCurrentSession === "function") {
				const session = await api.getCurrentSession()
				const isAuth = !!session
				log("Authentication status via getCurrentSession:", isAuth)
				return isAuth
			}
			log("No authentication method available")
			return false
		}

		const isAuth = await api.isAuthenticated()
		log("Authentication status:", !!isAuth)
		return !!isAuth
	} catch (error) {
		log("Error checking authentication:", error)
		return false
	}
}

/**
 * Get current user details
 * @param outputChannel Optional output channel for logging
 * @returns User object or null
 */
export async function getCurrentUser(outputChannel?: vscode.OutputChannel): Promise<any | null> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log("Getting current user")
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for getting current user")
			return null
		}

		const user = await api.getCurrentUser()
		log("Current user retrieved:", user ? "User found" : "No user")
		return user
	} catch (error) {
		log("Error getting current user:", error)
		return null
	}
}

/**
 * Store data in Firestore
 * @param collection Collection name
 * @param documentId Document ID
 * @param data Data to store
 * @param outputChannel Optional output channel for logging
 * @throws Error if storing fails
 */
export async function storeData(
	collection: string,
	documentId: string,
	data: Record<string, any>,
	outputChannel?: vscode.OutputChannel,
): Promise<void> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log(`Storing data in collection '${collection}', document '${documentId}'`)
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for storing data")
			throw new Error("Firebase API not available")
		}

		await api.storeData(collection, documentId, data)
		log("Data stored successfully")
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		log("Error storing data:", error)
		throw error
	}
}

/**
 * Get data from Firestore
 * @param collection Collection name
 * @param documentId Document ID
 * @param outputChannel Optional output channel for logging
 * @returns Document data or error object
 */
export async function getData(
	collection: string,
	documentId: string,
	outputChannel?: vscode.OutputChannel,
): Promise<any> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log(`Getting data from collection '${collection}', document '${documentId}'`)
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for getting data")
			return { error: "Firebase API not available" }
		}

		const result = await api.getData(collection, documentId)
		log("Data retrieved successfully")
		return result
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		log("Error getting data:", error)
		return {
			error: errorMessage,
		}
	}
}

/**
 * Get admin API key from Firebase
 * @param outputChannel Optional output channel for logging
 * @returns Admin API key or null if not found
 */
export async function getAdminApiKey(outputChannel?: vscode.OutputChannel): Promise<any | null> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for getting admin API key")
			return null
		}

		const adminConfig = await api.getAdminApiKey()

		return adminConfig || null
	} catch (error) {
		log("Error getting admin API key:", error)
		return null
	}
} /**
 * Get user properties from Firestore (users/{uid})
 * @param propertyNames Optional array of property names to retrieve. If not provided, returns all data.
 * @param outputChannel Optional output channel for logging
 * @returns User data object with requested properties or null if not found
 */
export async function getUserProperties(
	propertyNames?: string[],
	outputChannel?: vscode.OutputChannel,
): Promise<any | null> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log(
			"Getting user properties",
			propertyNames ? `for properties: ${propertyNames.join(", ")}` : "(all properties)",
		)
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for getting user properties")
			return null
		}

		const userData = await api.getUserProperties(propertyNames)
		log(userData ? "User properties retrieved" : "No user properties found")
		return userData || null
	} catch (error) {
		log("Error getting user properties:", error)
		return null
	}
}

/**
 * Update user properties in Firestore (users/{uid})
 * Can update one or multiple key-value pairs
 * @param updates Object containing field names and values to update
 * @param outputChannel Optional output channel for logging
 * @throws Error if update fails
 */
export async function updateUserProperties(
	updates: Record<string, any>,
	outputChannel?: vscode.OutputChannel,
): Promise<void> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log("Updating user properties:", Object.keys(updates))
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for updating user properties")
			throw new Error("Firebase API not available")
		}

		await api.updateUserProperties(updates)
		log("User properties updated successfully")
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		log("Error updating user properties:", error)
		throw error
	}
}

/**
 * Sign out the current user
 * @param outputChannel Optional output channel for logging
 */
export async function logout(outputChannel?: vscode.OutputChannel): Promise<void> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log("Logging out user")
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for logout")
			return
		}

		await api.signOut()
		log("User logged out successfully")
	} catch (error) {
		log("Error during logout:", error)
		throw error
	}
}

/**
 * Listen to authentication state changes
 * @param callback Function to call when auth state changes
 * @param outputChannel Optional output channel for logging
 * @returns Disposable to unsubscribe
 */
export async function onAuthStateChanged(
	callback: (isAuthenticated: boolean) => void,
	outputChannel?: vscode.OutputChannel,
): Promise<vscode.Disposable | null> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log("Setting up auth state change listener")
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for auth state listener")
			return null
		}

		// Firebase API's onAuthStateChanged should return a disposable
		const disposable = api.onAuthStateChanged(callback)
		log("Auth state change listener set up successfully")
		return disposable
	} catch (error) {
		log("Error setting up auth state listener:", error)
		return null
	}
}

/**
 * Clear the cached Firebase API instance
 * Useful when the Firebase Service extension is updated or reloaded
 */
export function clearFirebaseAPICache(): void {
	cachedFirebaseAPI = null
}

/**
 * Login to Firebase
 * @param outputChannel Optional output channel for logging
 */
export async function onFirebaseLogin(outputChannel?: vscode.OutputChannel): Promise<void> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log("Initiating Firebase login")
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for login")
			throw new Error("Firebase API not available")
		}

		// Assuming the API has a login method, but since login is via command, perhaps call the command
		// But since this is a helper, perhaps just call the command
		log("Executing Firebase sign-in command")
		await vscode.commands.executeCommand("firebase-service.signIn")
		log("Firebase login command executed")
	} catch (error) {
		log("Error during Firebase login:", error)
		throw error
	}
}

/**
 * Logout from Firebase
 * @param outputChannel Optional output channel for logging
 */
export async function onFirebaseLogout(outputChannel?: vscode.OutputChannel): Promise<void> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	log("Initiating Firebase logout")
	await logout(outputChannel)
}
