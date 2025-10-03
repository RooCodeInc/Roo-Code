/**
 * Medium TypeScript Interfaces File 2
 * Purpose: E-commerce domain models and business logic types for condensation testing
 */

// Product-related interfaces
export interface Product {
	id: string
	sku: string
	name: string
	description: string
	shortDescription?: string
	category: Category
	subcategories: string[]
	brand: Brand
	pricing: ProductPricing
	inventory: InventoryInfo
	media: ProductMedia[]
	attributes: ProductAttribute[]
	specifications: Record<string, string>
	dimensions?: ProductDimensions
	weight?: ProductWeight
	tags: string[]
	seo: SEOMetadata
	status: ProductStatus
	visibility: ProductVisibility
	variants?: ProductVariant[]
	relatedProducts?: string[]
	reviews: ReviewSummary
	createdAt: string
	updatedAt: string
	publishedAt?: string
}

export interface Category {
	id: string
	name: string
	slug: string
	parentId?: string
	level: number
	description?: string
	image?: string
	displayOrder: number
	isActive: boolean
}

export interface Brand {
	id: string
	name: string
	slug: string
	logo?: string
	description?: string
	website?: string
	isVerified: boolean
}

export interface ProductPricing {
	basePrice: number
	salePrice?: number
	currency: string
	costPrice?: number
	marginPercentage?: number
	taxRate?: number
	taxIncluded: boolean
	discounts?: Discount[]
	priceHistory?: PricePoint[]
}

export interface Discount {
	id: string
	type: "percentage" | "fixed" | "buy-x-get-y"
	value: number
	startDate: string
	endDate: string
	conditions?: DiscountCondition[]
	priority: number
}

export interface DiscountCondition {
	type: "minimum-quantity" | "minimum-amount" | "customer-group" | "coupon-code"
	value: string | number
}

export interface PricePoint {
	price: number
	timestamp: string
	reason?: string
}

export interface InventoryInfo {
	quantity: number
	reserved: number
	available: number
	reorderPoint: number
	reorderQuantity: number
	leadTime?: number
	backorderAllowed: boolean
	trackInventory: boolean
	locations?: InventoryLocation[]
}

export interface InventoryLocation {
	warehouseId: string
	quantity: number
	reserved: number
	zone?: string
	bin?: string
}

export interface ProductMedia {
	id: string
	type: "image" | "video" | "360" | "pdf"
	url: string
	thumbnailUrl?: string
	altText?: string
	title?: string
	displayOrder: number
	isDefault: boolean
	metadata?: Record<string, unknown>
}

export interface ProductAttribute {
	id: string
	name: string
	value: string | number | boolean
	displayName?: string
	unit?: string
	isFilterable: boolean
	displayOrder: number
}

export interface ProductDimensions {
	length: number
	width: number
	height: number
	unit: "cm" | "in" | "m"
}

export interface ProductWeight {
	value: number
	unit: "kg" | "lb" | "g" | "oz"
}

export interface SEOMetadata {
	title?: string
	description?: string
	keywords?: string[]
	canonicalUrl?: string
	ogImage?: string
	structuredData?: Record<string, unknown>
}

export type ProductStatus = "draft" | "active" | "discontinued" | "out-of-stock"
export type ProductVisibility = "public" | "hidden" | "private" | "catalog-only"

export interface ProductVariant {
	id: string
	productId: string
	sku: string
	name: string
	attributes: Record<string, string>
	pricing: ProductPricing
	inventory: InventoryInfo
	media?: ProductMedia[]
	isDefault: boolean
}

export interface ReviewSummary {
	averageRating: number
	totalReviews: number
	ratingDistribution: Record<string, number>
	verifiedPurchases: number
}

// Order-related interfaces
export interface Order {
	id: string
	orderNumber: string
	customerId: string
	status: OrderStatus
	items: OrderItem[]
	totals: OrderTotals
	payment: PaymentInfo
	shipping: ShippingInfo
	billing: BillingAddress
	timeline: OrderTimeline[]
	notes?: OrderNote[]
	metadata?: Record<string, unknown>
	createdAt: string
	updatedAt: string
}

export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded"

export interface OrderItem {
	id: string
	productId: string
	variantId?: string
	name: string
	sku: string
	quantity: number
	unitPrice: number
	subtotal: number
	tax: number
	discount?: number
	total: number
	attributes?: Record<string, string>
	customization?: string
	status: OrderItemStatus
}

export type OrderItemStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "returned"

export interface OrderTotals {
	subtotal: number
	shipping: number
	tax: number
	discount: number
	total: number
	currency: string
	refunded?: number
}

export interface PaymentInfo {
	method: PaymentMethod
	status: PaymentStatus
	transactionId?: string
	processor?: string
	cardLast4?: string
	cardBrand?: string
	paidAt?: string
	refundedAt?: string
	refundAmount?: number
}

export type PaymentMethod = "credit-card" | "debit-card" | "paypal" | "bank-transfer" | "crypto" | "cod"

export type PaymentStatus = "pending" | "authorized" | "captured" | "failed" | "refunded" | "partially-refunded"

export interface ShippingInfo {
	method: string
	carrier?: string
	service?: string
	trackingNumber?: string
	trackingUrl?: string
	address: Address
	estimatedDelivery?: string
	actualDelivery?: string
	cost: number
	weight?: number
}

export interface BillingAddress extends Address {
	isDefault: boolean
	sameAsShipping: boolean
}

export interface Address {
	firstName: string
	lastName: string
	company?: string
	street1: string
	street2?: string
	city: string
	state?: string
	postalCode: string
	country: string
	countryCode: string
	phone?: string
	email?: string
}

export interface OrderTimeline {
	status: OrderStatus
	timestamp: string
	note?: string
	actor?: string
	metadata?: Record<string, unknown>
}

export interface OrderNote {
	id: string
	author: string
	content: string
	isPrivate: boolean
	createdAt: string
}

// Shopping cart interfaces
export interface ShoppingCart {
	id: string
	customerId?: string
	sessionId: string
	items: CartItem[]
	totals: CartTotals
	coupons: AppliedCoupon[]
	expiresAt: string
	createdAt: string
	updatedAt: string
}

export interface CartItem {
	id: string
	productId: string
	variantId?: string
	name: string
	sku: string
	quantity: number
	price: number
	subtotal: number
	image?: string
	attributes?: Record<string, string>
	customization?: string
	availability: CartItemAvailability
}

export interface CartItemAvailability {
	inStock: boolean
	quantity: number
	backorderAllowed: boolean
	estimatedShipDate?: string
}

export interface CartTotals {
	subtotal: number
	shipping: number
	tax: number
	discount: number
	total: number
	currency: string
	savings?: number
}

export interface AppliedCoupon {
	code: string
	type: "percentage" | "fixed" | "free-shipping"
	value: number
	appliedAmount: number
	validUntil?: string
}
