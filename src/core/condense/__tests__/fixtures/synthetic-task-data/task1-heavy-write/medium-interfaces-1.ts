/**
 * Medium TypeScript Interfaces File 1
 * Purpose: Comprehensive API response and request type definitions for testing condensation
 */

// Base types
export type UUID = string
export type Timestamp = number
export type ISODateString = string

// User-related interfaces
export interface User {
	id: UUID
	username: string
	email: string
	firstName: string
	lastName: string
	dateOfBirth: ISODateString
	phoneNumber?: string
	avatar?: string
	bio?: string
	website?: string
	location?: Location
	preferences: UserPreferences
	metadata: UserMetadata
	createdAt: Timestamp
	updatedAt: Timestamp
	lastLoginAt?: Timestamp
}

export interface UserPreferences {
	language: string
	timezone: string
	theme: "light" | "dark" | "auto"
	notifications: NotificationPreferences
	privacy: PrivacySettings
	accessibility: AccessibilitySettings
}

export interface NotificationPreferences {
	email: boolean
	push: boolean
	sms: boolean
	inApp: boolean
	frequency: "realtime" | "daily" | "weekly" | "never"
	categories: {
		marketing: boolean
		updates: boolean
		security: boolean
		social: boolean
	}
}

export interface PrivacySettings {
	profileVisibility: "public" | "friends" | "private"
	showEmail: boolean
	showPhone: boolean
	showLocation: boolean
	allowSearchEngineIndexing: boolean
	dataSharing: boolean
}

export interface AccessibilitySettings {
	fontSize: "small" | "medium" | "large" | "extra-large"
	highContrast: boolean
	reduceMotion: boolean
	screenReader: boolean
	keyboardNavigation: boolean
}

export interface UserMetadata {
	ipAddress?: string
	userAgent?: string
	referrer?: string
	utmSource?: string
	utmMedium?: string
	utmCampaign?: string
	signupMethod: "email" | "google" | "github" | "apple"
	isEmailVerified: boolean
	isPhoneVerified: boolean
	accountStatus: "active" | "suspended" | "deleted" | "pending"
	roles: UserRole[]
	permissions: Permission[]
}

export interface UserRole {
	id: UUID
	name: string
	description: string
	priority: number
	isSystem: boolean
}

export interface Permission {
	id: UUID
	resource: string
	action: "create" | "read" | "update" | "delete" | "execute"
	conditions?: Record<string, unknown>
}

export interface Location {
	country: string
	countryCode: string
	state?: string
	city?: string
	postalCode?: string
	latitude?: number
	longitude?: number
	timezone?: string
}

// API Response types
export interface ApiResponse<T = unknown> {
	success: boolean
	data?: T
	error?: ApiError
	metadata: ResponseMetadata
}

export interface ApiError {
	code: string
	message: string
	details?: Record<string, unknown>
	stackTrace?: string
	timestamp: Timestamp
}

export interface ResponseMetadata {
	requestId: UUID
	timestamp: Timestamp
	duration: number
	version: string
	deprecation?: DeprecationInfo
}

export interface DeprecationInfo {
	message: string
	sunsetDate: ISODateString
	alternativeEndpoint?: string
	documentationUrl?: string
}

// Pagination types
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
	pagination: PaginationInfo
}

export interface PaginationInfo {
	currentPage: number
	pageSize: number
	totalPages: number
	totalItems: number
	hasNextPage: boolean
	hasPreviousPage: boolean
	nextCursor?: string
	previousCursor?: string
}

export interface PaginationRequest {
	page?: number
	limit?: number
	cursor?: string
	sortBy?: string
	sortOrder?: "asc" | "desc"
}

// Search and filter types
export interface SearchRequest {
	query: string
	filters?: SearchFilters
	pagination?: PaginationRequest
	options?: SearchOptions
}

export interface SearchFilters {
	category?: string[]
	tags?: string[]
	dateRange?: DateRange
	priceRange?: NumericRange
	location?: LocationFilter
	customFields?: Record<string, unknown>
}

export interface DateRange {
	start: ISODateString
	end: ISODateString
}

export interface NumericRange {
	min?: number
	max?: number
}

export interface LocationFilter {
	latitude: number
	longitude: number
	radius: number
	unit: "km" | "mi"
}

export interface SearchOptions {
	fuzzyMatch: boolean
	caseSensitive: boolean
	highlightMatches: boolean
	includeScore: boolean
	boostFields?: Record<string, number>
}

export interface SearchResult<T> {
	item: T
	score: number
	highlights?: Record<string, string[]>
	explanation?: string
}

// Webhook types
export interface WebhookConfig {
	id: UUID
	url: string
	events: WebhookEvent[]
	headers?: Record<string, string>
	secret: string
	isActive: boolean
	retryPolicy: RetryPolicy
	createdAt: Timestamp
	updatedAt: Timestamp
}

export type WebhookEvent =
	| "user.created"
	| "user.updated"
	| "user.deleted"
	| "payment.processed"
	| "payment.failed"
	| "order.created"
	| "order.fulfilled"
	| "order.cancelled"

export interface RetryPolicy {
	maxAttempts: number
	backoffMultiplier: number
	initialDelay: number
	maxDelay: number
}

export interface WebhookPayload<T = unknown> {
	id: UUID
	event: WebhookEvent
	timestamp: Timestamp
	data: T
	attemptNumber: number
}
