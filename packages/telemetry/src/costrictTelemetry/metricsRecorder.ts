import { TelemetryEvent, TelemetryEventName } from "@roo-code/types"

export interface MetricData {
	name: string
	modelId: string
	strValue: string | null
	apiProvider?: string
	value: number
}

export interface MetricItem {
	name: string
	model_id?: string
	value: number
	str_value: string | null
}

export interface MetricsReport {
	metrics: MetricItem[]
	labels: {
		language: string
		apiProvider?: string
	}
}

export interface RecordProperties {
	language: string
	modelId?: string
	apiProvider?: string
	lines?: number
	responceTime?: number
	action?: string
	error_type?: string
}

export interface ErrorMetricData {
	errorType: string
	count: number
}

type MetricKey = string
type LanguageMetricsMap = Map<MetricKey, MetricData>
type MetricsStore = Map<string, LanguageMetricsMap>
type ErrorMetricsStore = Map<string, number>

export class MetricsRecorder {
	private store: MetricsStore = new Map()
	private errorStore: ErrorMetricsStore = new Map()

	private buildMetricKey(name: string, modelId: string, strValue: string | null): MetricKey {
		return `${name}|${modelId}|${strValue ?? "null"}`
	}

	private getOrCreateLanguageMap(language: string): LanguageMetricsMap {
		let langMap = this.store.get(language)
		if (!langMap) {
			langMap = new Map()
			this.store.set(language, langMap)
		}
		return langMap
	}

	private addMetric(
		language: string,
		name: string,
		modelId: string,
		value: number,
		strValue: string | null = null,
		apiProvider?: string,
	): void {
		const langMap = this.getOrCreateLanguageMap(language)
		const key = this.buildMetricKey(name, modelId, strValue)
		const existing = langMap.get(key)
		if (existing) {
			existing.value += value
			if (apiProvider && !existing.apiProvider) {
				existing.apiProvider = apiProvider
			}
		} else {
			langMap.set(key, {
				name,
				modelId,
				strValue,
				apiProvider,
				value,
			})
		}
	}

	private addError(errorType: string): void {
		const existing = this.errorStore.get(errorType) ?? 0
		this.errorStore.set(errorType, existing + 1)
	}

	public record(event: TelemetryEvent): void {
		const properties = event.properties as RecordProperties | undefined
		if (!properties) return

		const { modelId = "", apiProvider, lines = 0, responceTime = 0, action, error_type } = properties

		if (event.event === TelemetryEventName.ERROR) {
			if (error_type) {
				this.addError(error_type)
			}
			return
		}
		const language = properties.language?.toLowerCase()

		if (!language) return
		switch (event.event) {
			case TelemetryEventName.CODE_ACCEPT:
				this.addMetric(language, "code_accept_frequency", modelId, 1, null, apiProvider)
				this.addMetric(language, "code_accept_lines", modelId, lines, null, apiProvider)
				break
			case TelemetryEventName.CODE_REJECT:
				this.addMetric(language, "code_reject_frequency", modelId, 1, null, apiProvider)
				this.addMetric(language, "code_reject_lines", modelId, lines, null, apiProvider)
				break
			case TelemetryEventName.CODE_TAB_COMPLETION:
				this.addMetric(language, "code_completion_frequency", modelId, 1, action, apiProvider)
				this.addMetric(language, "code_completion_lines", modelId, lines, action, apiProvider)
				this.addMetric(language, "code_completion_response_time", modelId, responceTime, null, apiProvider)
				break
			default:
				break
		}
	}

	public getMetrics(): MetricsReport[] {
		const groupedReports = new Map<string, MetricsReport>()

		for (const [language, langMap] of this.store) {
			for (const [, metricData] of langMap) {
				if (metricData.value === 0) continue

				const groupKey = `${language}|${metricData.apiProvider ?? ""}`
				let report = groupedReports.get(groupKey)

				if (!report) {
					report = {
						metrics: [],
						labels: {
							language,
							...(metricData.apiProvider && { apiProvider: metricData.apiProvider }),
						},
					}
					groupedReports.set(groupKey, report)
				}

				report.metrics.push({
					name: metricData.name,
					model_id: metricData.modelId === "" ? "_" : metricData.modelId,
					value: metricData.value,
					str_value: metricData.strValue ? metricData.strValue : "",
				})
			}
		}

		const reports = Array.from(groupedReports.values())

		const errorMetrics = this.getErrorMetrics()
		if (errorMetrics.length > 0) {
			reports.push({
				metrics: errorMetrics,
				labels: {
					language: "_",
				},
			})
		}

		return reports
	}

	private getErrorMetrics(): MetricItem[] {
		const metrics: MetricItem[] = []
		for (const [errorType, count] of this.errorStore) {
			if (count === 0) continue
			metrics.push({
				name: "errors_frequency",
				model_id: "_",
				value: count,
				str_value: errorType,
			})
		}
		return metrics
	}

	public resetValues(): void {
		for (const [, langMap] of this.store) {
			for (const [, metricData] of langMap) {
				metricData.value = 0
			}
		}
		for (const key of this.errorStore.keys()) {
			this.errorStore.set(key, 0)
		}
	}
}
