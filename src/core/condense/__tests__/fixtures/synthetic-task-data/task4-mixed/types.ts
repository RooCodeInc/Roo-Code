/**
 * TypeScript type definitions for task4-mixed test fixture
 */

export interface Config {
	apiVersion: string
	environment: string
	endpoints: Endpoints
	timeout: number
	retryAttempts: number
	features: Features
}

export interface Endpoints {
	base: string
	auth: string
	data: string
}

export interface Features {
	caching: boolean
	compression: boolean
	logging: boolean
}

export interface User {
	id: string
	email: string
	name: string
	createdAt: Date
	updatedAt: Date
}

export interface ApiResponse<T> {
	success: boolean
	data?: T
	error?: string
	timestamp: string
}

export type RequestMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

export interface RequestOptions {
	method: RequestMethod
	headers?: Record<string, string>
	body?: unknown
	timeout?: number
}

export interface ErrorDetails {
	code: string
	message: string
	timestamp: Date
	stackTrace?: string
}
