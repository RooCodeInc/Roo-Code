/**
 * Medium TypeScript Interfaces File 4
 * Purpose: Social media, messaging, and notification system types for condensation testing
 */

// Social media post types
export interface SocialPost {
	id: string
	authorId: string
	author: UserProfile
	type: PostType
	content: PostContent
	visibility: PostVisibility
	attachments: Attachment[]
	mentions: Mention[]
	hashtags: string[]
	location?: PostLocation
	engagement: EngagementMetrics
	moderation: ModerationInfo
	status: PostStatus
	createdAt: string
	updatedAt: string
	publishedAt?: string
	deletedAt?: string
}

export type PostType = "text" | "image" | "video" | "link" | "poll" | "story" | "repost" | "article"

export interface PostContent {
	text?: string
	html?: string
	markdown?: string
	characterCount: number
	language?: string
	translations?: Record<string, string>
}

export type PostVisibility = "public" | "followers" | "friends" | "private" | "unlisted"

export interface Attachment {
	id: string
	type: AttachmentType
	url: string
	thumbnailUrl?: string
	width?: number
	height?: number
	duration?: number
	size: number
	mimeType: string
	altText?: string
	caption?: string
	metadata?: AttachmentMetadata
}

export type AttachmentType = "image" | "video" | "audio" | "document" | "link" | "gif"

export interface AttachmentMetadata {
	title?: string
	description?: string
	siteName?: string
	favicon?: string
	color?: string
	[key: string]: unknown
}

export interface Mention {
	userId: string
	username: string
	displayName: string
	startIndex: number
	endIndex: number
}

export interface PostLocation {
	name: string
	address?: string
	city?: string
	country?: string
	latitude: number
	longitude: number
	placeId?: string
}

export interface EngagementMetrics {
	likes: number
	comments: number
	shares: number
	views: number
	saves: number
	clicks?: number
	reach?: number
	impressions?: number
}

export interface ModerationInfo {
	status: ModerationStatus
	flags: ModerationFlag[]
	reviewedBy?: string
	reviewedAt?: string
	notes?: string
}

export type ModerationStatus = "approved" | "pending" | "flagged" | "removed" | "shadow-banned"

export interface ModerationFlag {
	type: FlagType
	reason: string
	reporterId?: string
	severity: "low" | "medium" | "high" | "critical"
	timestamp: string
}

export type FlagType =
	| "spam"
	| "harassment"
	| "hate-speech"
	| "violence"
	| "adult-content"
	| "misinformation"
	| "copyright"
	| "other"

export type PostStatus = "draft" | "scheduled" | "published" | "archived" | "deleted"

export interface UserProfile {
	id: string
	username: string
	displayName: string
	avatar?: string
	bio?: string
	isVerified: boolean
	followerCount: number
	followingCount: number
	postCount: number
}

// Comment types
export interface Comment {
	id: string
	postId: string
	authorId: string
	author: UserProfile
	parentId?: string
	content: string
	mentions: Mention[]
	attachments: Attachment[]
	likes: number
	replies: number
	isEdited: boolean
	isPinned: boolean
	moderation: ModerationInfo
	createdAt: string
	updatedAt: string
	deletedAt?: string
}

// Direct messaging types
export interface Conversation {
	id: string
	type: ConversationType
	participants: Participant[]
	name?: string
	avatar?: string
	description?: string
	lastMessage?: Message
	unreadCount: number
	isMuted: boolean
	isPinned: boolean
	settings: ConversationSettings
	metadata?: Record<string, unknown>
	createdAt: string
	updatedAt: string
}

export type ConversationType = "direct" | "group" | "channel" | "support"

export interface Participant {
	userId: string
	role: ParticipantRole
	joinedAt: string
	lastReadAt?: string
	isMuted: boolean
	permissions: ParticipantPermissions
}

export type ParticipantRole = "owner" | "admin" | "moderator" | "member" | "guest"

export interface ParticipantPermissions {
	canSendMessages: boolean
	canSendMedia: boolean
	canAddMembers: boolean
	canRemoveMembers: boolean
	canEditInfo: boolean
	canPinMessages: boolean
	canDeleteMessages: boolean
}

export interface ConversationSettings {
	allowInvites: boolean
	requireApproval: boolean
	allowLinks: boolean
	allowMedia: boolean
	messageRetention?: number
	isPublic: boolean
}

export interface Message {
	id: string
	conversationId: string
	senderId: string
	type: MessageType
	content: MessageContent
	replyToId?: string
	forwardedFromId?: string
	attachments: Attachment[]
	mentions: Mention[]
	reactions: Reaction[]
	status: MessageStatus
	isPinned: boolean
	isEdited: boolean
	metadata?: Record<string, unknown>
	createdAt: string
	updatedAt: string
	deletedAt?: string
	expiresAt?: string
}

export type MessageType = "text" | "image" | "video" | "audio" | "file" | "location" | "contact" | "poll" | "system"

export interface MessageContent {
	text?: string
	richText?: RichTextElement[]
	encryption?: EncryptionInfo
}

export interface RichTextElement {
	type: "text" | "link" | "mention" | "emoji" | "code"
	content: string
	attributes?: Record<string, unknown>
}

export interface EncryptionInfo {
	algorithm: string
	keyId: string
	isEndToEnd: boolean
}

export interface Reaction {
	emoji: string
	count: number
	userIds: string[]
}

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed"

// Notification types
export interface Notification {
	id: string
	userId: string
	type: NotificationType
	category: NotificationCategory
	title: string
	body: string
	data: NotificationData
	action?: NotificationAction
	priority: NotificationPriority
	channels: NotificationChannel[]
	status: NotificationStatus
	isRead: boolean
	readAt?: string
	expiresAt?: string
	createdAt: string
}

export type NotificationType =
	| "follow"
	| "like"
	| "comment"
	| "mention"
	| "message"
	| "friend-request"
	| "system"
	| "promotional"
	| "reminder"

export type NotificationCategory = "social" | "transaction" | "system" | "marketing" | "security"

export interface NotificationData {
	actorId?: string
	actorName?: string
	actorAvatar?: string
	targetId?: string
	targetType?: string
	targetUrl?: string
	metadata?: Record<string, unknown>
}

export interface NotificationAction {
	label: string
	url?: string
	action?: string
	parameters?: Record<string, unknown>
}

export type NotificationPriority = "low" | "normal" | "high" | "urgent"

export type NotificationChannel = "push" | "email" | "sms" | "in-app" | "webhook"

export type NotificationStatus = "pending" | "sent" | "delivered" | "failed" | "cancelled"

export interface NotificationPreferences {
	userId: string
	channels: ChannelPreferences
	types: TypePreferences
	quietHours?: QuietHours
	frequency: FrequencySettings
}

export interface ChannelPreferences {
	push: ChannelSettings
	email: ChannelSettings
	sms: ChannelSettings
	inApp: ChannelSettings
}

export interface ChannelSettings {
	enabled: boolean
	categories: Record<NotificationCategory, boolean>
}

export interface TypePreferences {
	[key: string]: boolean
}

export interface QuietHours {
	enabled: boolean
	startTime: string
	endTime: string
	timezone: string
	daysOfWeek: number[]
}

export interface FrequencySettings {
	maxPerHour?: number
	maxPerDay?: number
	digestEnabled: boolean
	digestFrequency?: "daily" | "weekly"
	digestTime?: string
}

// Activity feed types
export interface ActivityFeedItem {
	id: string
	type: ActivityType
	actorId: string
	actor: UserProfile
	action: string
	targetId: string
	targetType: string
	target?: ActivityTarget
	metadata?: Record<string, unknown>
	aggregationKey?: string
	aggregatedCount?: number
	timestamp: string
}

export type ActivityType = "post" | "comment" | "like" | "follow" | "share" | "mention" | "achievement" | "milestone"

export interface ActivityTarget {
	id: string
	type: string
	title?: string
	image?: string
	url?: string
}
