/**
 * GetServiceLogsTool - 获取后台服务日志的工具
 *
 * 这个工具允许 AI 获取正在运行的后台服务的日志输出。
 * 用于调试和监控服务状态。
 */

import type { NativeToolArgs } from "../../shared/tools"
import { t } from "../../i18n"
import { ServiceManager } from "../../integrations/terminal/ServiceManager"
import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"

export class GetServiceLogsTool extends BaseTool<"get_service_logs"> {
	readonly name = "get_service_logs" as const

	/**
	 * 解析 XML/legacy 格式的参数
	 */
	parseLegacy(params: Partial<Record<string, string>>): NativeToolArgs["get_service_logs"] {
		const maxLinesStr = params.max_lines
		return {
			service_id: params.service_id || null,
			max_lines: maxLinesStr ? parseInt(maxLinesStr, 10) : null,
		}
	}

	/**
	 * 执行工具核心逻辑
	 */
	async execute(params: NativeToolArgs["get_service_logs"], _task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { handleError, pushToolResult } = callbacks
		// 正确处理 service_id：null、undefined 或空字符串都视为未指定
		const serviceId =
			params.service_id && typeof params.service_id === "string" && params.service_id.trim() !== ""
				? params.service_id.trim()
				: undefined
		const maxLines = params.max_lines || 100

		try {
			// 如果没有指定 service_id，返回所有服务的概览
			if (!serviceId) {
				// 获取所有运行中的服务
				const runningServices = ServiceManager.getRunningServices()
				if (runningServices.length === 0) {
					pushToolResult(t("tools:get_service_logs.no_services"))
					return
				}

				// 返回服务列表
				const serviceList = runningServices.map((s) => ({
					serviceId: s.serviceId,
					command: s.command,
					status: s.status,
					pid: s.pid,
					startedAt: s.startedAt ? new Date(s.startedAt).toISOString() : undefined,
				}))

				pushToolResult(
					[
						t("tools:get_service_logs.available_services"),
						"",
						...serviceList.map(
							(s) => `- ${s.serviceId}: ${s.command} (${s.status}, PID: ${s.pid || "N/A"})`,
						),
						"",
						t("tools:get_service_logs.usage_hint"),
					].join("\n"),
				)
				return
			}

			// 获取指定服务的日志
			const service = ServiceManager.getService(serviceId)
			if (!service) {
				// 如果服务不存在，先列出所有可用服务
				const runningServices = ServiceManager.getRunningServices()
				const availableServices = runningServices.map((s) => s.serviceId).join(", ")
				pushToolResult(
					[
						t("tools:get_service_logs.service_not_found", { serviceId }),
						"",
						availableServices.length > 0
							? `Available service IDs: ${availableServices}`
							: "No services are currently running.",
					].join("\n"),
				)
				return
			}

			// 获取日志（这会自动获取未检索的输出）
			const logs = ServiceManager.getServiceLogs(serviceId, maxLines)

			// 构建返回信息
			const serviceInfo = [
				t("tools:get_service_logs.service_info", {
					serviceId,
					command: service.command,
					status: service.status,
				}),
				`PID: ${service.pid || "N/A"}`,
				`Started: ${service.startedAt ? new Date(service.startedAt).toISOString() : "N/A"}`,
				`Status: ${service.status}`,
				`Log lines available: ${logs.length}`,
				"",
			]

			if (logs.length === 0) {
				// 即使没有日志，也返回服务信息和调试信息
				serviceInfo.push(t("tools:get_service_logs.no_logs"))
				serviceInfo.push("")
				serviceInfo.push(
					"Note: The service may not have produced any output yet. " +
						"This is normal for services that are still starting up or have minimal output.",
				)
				pushToolResult(serviceInfo.join("\n"))
				return
			}

			// 返回日志
			serviceInfo.push(`--- Terminal Output (last ${logs.length} lines) ---`)
			serviceInfo.push("")
			serviceInfo.push(...logs)
			pushToolResult(serviceInfo.join("\n"))
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			await handleError("getting service logs", new Error(errorMessage))
			pushToolResult(`Error getting service logs: ${errorMessage}`)
		}
	}
}

// 导出单例实例
export const getServiceLogsTool = new GetServiceLogsTool()
