import { Registry, Counter, Histogram, Metric, Gauge } from "prom-client"
import * as fs from "fs/promises"
import path from "path"
import { ILogger } from "../../../../src/utils/logger"

interface SerializedMetric {
	name: string
	help: string
	type: string
	values: {
		value: number
		labels: Record<string, string | number>
		metricName?: string
	}[]
	aggregator: string
}

export class MetricsSerializer {
	constructor(private logger: ILogger) {}

	public async save(registry: Registry, filePath: string): Promise<void> {
		try {
			const metrics = await registry.getMetricsAsJSON()
			await fs.mkdir(path.dirname(filePath), { recursive: true })
			await fs.writeFile(filePath, JSON.stringify(metrics, null, 2))
			this.logger.debug(`[MetricsSerializer] Metrics saved to ${filePath}`)
		} catch (error) {
			this.logger.error(`[MetricsSerializer] Failed to save metrics: ${error}`)
		}
	}

	public async load(registry: Registry, filePath: string): Promise<void> {
		try {
			const data = await fs.readFile(filePath, "utf-8")
			const metrics: SerializedMetric[] = JSON.parse(data)
			for (const metricData of metrics) {
				const metric: Metric<string> | undefined = registry.getSingleMetric(metricData.name)
				if (!metric) {
					continue
				}

				if (metric instanceof Counter) {
					for (const item of metricData.values) {
						metric.inc(item.labels, item.value)
					}
				} else if (metric instanceof Histogram) {
					const sumMetrics = metricData.values.filter((v) => v.metricName?.endsWith("_sum"))
					let HistogramLogs: { [key: string]: number[] } | null = null
					sumMetrics.forEach((sumValue) => {
						if (sumValue && sumValue.value > 0) {
							metric.observe(sumValue.labels, sumValue.value)
							if (HistogramLogs === null) {
								HistogramLogs = {}
							}
							if (HistogramLogs[metricData.name]) {
								HistogramLogs[metricData.name].push(sumValue.value)
							} else {
								HistogramLogs[metricData.name] = [sumValue.value]
							}
						}
					})
					// eslint-disable-next-line @typescript-eslint/no-unused-expressions
					HistogramLogs &&
						Object.keys(HistogramLogs).forEach((name) => {
							this.logger.debug(
								`[MetricsSerializer] Histogram sum for ${name} loaded with value: ${HistogramLogs![name].join()}`,
							)
						})
				} else if (metric instanceof Gauge) {
					for (const item of metricData.values) {
						metric.set(item.labels, item.value)
					}
				}
			}
			this.logger.debug(`[MetricsSerializer] Metrics loaded into registry from ${filePath}`)
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "ENOENT") {
				this.logger.debug(`[MetricsSerializer] No metrics file at ${filePath}. Starting with a fresh registry.`)
			} else {
				this.logger.error(`[MetricsSerializer] Failed to load metrics: ${error}`)
			}
		}
	}
}
