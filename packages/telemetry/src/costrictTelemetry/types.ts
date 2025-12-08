export interface StringValueIndicator {
	name: string
	values: string[]
}

export interface TelemetryUserInfo {
	username: string
	department: string
	id: string
}

export interface TelemetryControlResponse {
	enable: boolean
	supportedLanguages: string[]
	supportedIndicator: string[]
	stringValueIndicator: StringValueIndicator[]
	reportIntervalMinutes: number
	maxBatchSize: number
	maxMetricsSize: number
	userInfo: TelemetryUserInfo
}
