/**
 * Medium TypeScript Interfaces File 3
 * Purpose: Analytics, metrics, and monitoring type definitions for testing condensation
 */

// Analytics event types
export interface AnalyticsEvent {
	id: string
	type: EventType
	category: EventCategory
	action: string
	label?: string
	value?: number
	userId?: string
	sessionId: string
	timestamp: string
	properties: EventProperties
	context: EventContext
	metadata?: Record<string, unknown>
}

export type EventType =
	| "pageview"
	| "click"
	| "form_submission"
	| "purchase"
	| "search"
	| "video_play"
	| "video_complete"
	| "download"
	| "signup"
	| "login"
	| "logout"
	| "error"
	| "custom"

export type EventCategory =
	| "engagement"
	| "conversion"
	| "navigation"
	| "content"
	| "social"
	| "video"
	| "commerce"
	| "user"
	| "system"

export interface EventProperties {
	page?: PageProperties
	product?: ProductEventProperties
	user?: UserEventProperties
	campaign?: CampaignProperties
	custom?: Record<string, unknown>
}

export interface PageProperties {
	url: string
	path: string
	title: string
	referrer?: string
	search?: string
	hash?: string
}

export interface ProductEventProperties {
	id: string
	name: string
	category: string
	brand?: string
	price: number
	quantity: number
	variant?: string
	position?: number
}

export interface UserEventProperties {
	id?: string
	email?: string
	name?: string
	role?: string
	segment?: string
	cohort?: string
}

export interface CampaignProperties {
	source?: string
	medium?: string
	campaign?: string
	term?: string
	content?: string
}

export interface EventContext {
	userAgent: string
	ip?: string
	locale: string
	timezone: string
	screen: ScreenProperties
	device: DeviceProperties
	location?: LocationProperties
	app?: AppProperties
}

export interface ScreenProperties {
	width: number
	height: number
	density: number
	colorDepth: number
}

export interface DeviceProperties {
	type: "desktop" | "mobile" | "tablet" | "tv" | "wearable"
	manufacturer?: string
	model?: string
	os: string
	osVersion: string
	browser: string
	browserVersion: string
}

export interface LocationProperties {
	country: string
	countryCode: string
	region?: string
	city?: string
	latitude?: number
	longitude?: number
}

export interface AppProperties {
	name: string
	version: string
	build?: string
	namespace?: string
}

// Metrics and KPI types
export interface MetricData {
	metric: string
	value: number
	unit?: string
	timestamp: string
	dimensions?: MetricDimensions
	tags?: Record<string, string>
	aggregation?: AggregationType
}

export type AggregationType = "sum" | "avg" | "min" | "max" | "count" | "percentile"

export interface MetricDimensions {
	service?: string
	environment?: string
	region?: string
	host?: string
	[key: string]: string | undefined
}

export interface TimeSeriesData {
	metric: string
	dataPoints: DataPoint[]
	aggregation: AggregationType
	interval: string
	startTime: string
	endTime: string
}

export interface DataPoint {
	timestamp: string
	value: number
	dimensions?: MetricDimensions
}

export interface KPIDefinition {
	id: string
	name: string
	description: string
	formula: string
	unit: string
	target: number
	targetType: "minimum" | "maximum" | "exact"
	category: KPICategory
	frequency: "realtime" | "hourly" | "daily" | "weekly" | "monthly"
	owners: string[]
	dependencies?: string[]
}

export type KPICategory = "revenue" | "growth" | "engagement" | "retention" | "performance" | "quality" | "operational"

export interface KPIValue {
	kpiId: string
	value: number
	target: number
	achievement: number
	trend: TrendDirection
	period: TimePeriod
	timestamp: string
}

export type TrendDirection = "up" | "down" | "stable"

export interface TimePeriod {
	start: string
	end: string
	type: "hour" | "day" | "week" | "month" | "quarter" | "year"
}

// Dashboard and reporting types
export interface Dashboard {
	id: string
	name: string
	description?: string
	category: string
	widgets: Widget[]
	layout: LayoutConfig
	filters: DashboardFilter[]
	refreshInterval?: number
	isPublic: boolean
	ownerId: string
	sharedWith?: string[]
	tags?: string[]
	createdAt: string
	updatedAt: string
}

export interface Widget {
	id: string
	type: WidgetType
	title: string
	description?: string
	dataSource: DataSourceConfig
	visualization: VisualizationConfig
	filters?: WidgetFilter[]
	position: WidgetPosition
	size: WidgetSize
	settings?: Record<string, unknown>
}

export type WidgetType =
	| "line-chart"
	| "bar-chart"
	| "pie-chart"
	| "area-chart"
	| "scatter-plot"
	| "heatmap"
	| "table"
	| "metric"
	| "gauge"
	| "funnel"
	| "map"

export interface DataSourceConfig {
	type: "metric" | "query" | "api" | "static"
	source: string
	parameters?: Record<string, unknown>
	transformations?: DataTransformation[]
	caching?: CachingConfig
}

export interface DataTransformation {
	type: "filter" | "aggregate" | "sort" | "limit" | "join" | "pivot"
	config: Record<string, unknown>
}

export interface CachingConfig {
	enabled: boolean
	ttl: number
	key?: string
}

export interface VisualizationConfig {
	chartType: string
	xAxis?: AxisConfig
	yAxis?: AxisConfig
	series?: SeriesConfig[]
	colors?: string[]
	legend?: LegendConfig
	tooltip?: TooltipConfig
	options?: Record<string, unknown>
}

export interface AxisConfig {
	label?: string
	type: "linear" | "logarithmic" | "time" | "category"
	min?: number
	max?: number
	format?: string
}

export interface SeriesConfig {
	name: string
	field: string
	type: "line" | "bar" | "area" | "scatter"
	color?: string
	yAxisId?: string
}

export interface LegendConfig {
	show: boolean
	position: "top" | "bottom" | "left" | "right"
	align: "start" | "center" | "end"
}

export interface TooltipConfig {
	show: boolean
	format?: string
	shared?: boolean
}

export interface WidgetFilter {
	field: string
	operator: FilterOperator
	value: unknown
	type: "dimension" | "metric" | "time"
}

export type FilterOperator =
	| "equals"
	| "not-equals"
	| "contains"
	| "not-contains"
	| "greater-than"
	| "less-than"
	| "between"
	| "in"
	| "not-in"

export interface WidgetPosition {
	x: number
	y: number
}

export interface WidgetSize {
	width: number
	height: number
	minWidth?: number
	minHeight?: number
}

export interface LayoutConfig {
	type: "grid" | "flex" | "absolute"
	columns?: number
	gap?: number
	padding?: number
}

export interface DashboardFilter {
	id: string
	field: string
	label: string
	type: "select" | "multi-select" | "date-range" | "text" | "number-range"
	options?: FilterOption[]
	defaultValue?: unknown
	required?: boolean
}

export interface FilterOption {
	label: string
	value: unknown
}

// Report types
export interface Report {
	id: string
	name: string
	description?: string
	type: ReportType
	format: ReportFormat
	schedule?: ReportSchedule
	recipients: ReportRecipient[]
	parameters: ReportParameter[]
	template?: string
	createdAt: string
	lastRunAt?: string
	nextRunAt?: string
}

export type ReportType = "performance" | "financial" | "user-activity" | "product-analytics" | "sales" | "custom"

export type ReportFormat = "pdf" | "csv" | "excel" | "html" | "json"

export interface ReportSchedule {
	enabled: boolean
	frequency: "daily" | "weekly" | "monthly" | "quarterly"
	dayOfWeek?: number
	dayOfMonth?: number
	time: string
	timezone: string
}

export interface ReportRecipient {
	email: string
	name?: string
	deliveryMethod: "email" | "slack" | "webhook"
	options?: Record<string, unknown>
}

export interface ReportParameter {
	name: string
	type: "string" | "number" | "date" | "boolean" | "array"
	required: boolean
	defaultValue?: unknown
	options?: unknown[]
}
