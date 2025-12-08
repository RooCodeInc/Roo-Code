/**
 * StopServiceTool - 停止后台服务的工具
 *
 * 这个工具允许 AI 停止正在运行的后台服务。
 * 它会正确终止进程树，确保服务和所有子进程都被停止。
 */

import type { NativeToolArgs } from "../../shared/tools"
import { t } from "../../i18n"
import { ServiceManager } from "../../integrations/terminal/ServiceManager"
import { Task } from "../task/Task"
import { BaseTool, ToolCallbacks } from "./BaseTool"

export class StopServiceTool extends BaseTool<"stop_service"> {
	readonly name = "stop_service" as const

	/**
	 * 解析 XML/legacy 格式的参数
	 */
	parseLegacy(params: Partial<Record<string, string>>): NativeToolArgs["stop_service"] {
		return {
			service_id: params.service_id || "",
		}
	}

	/**
	 * 执行工具核心逻辑
	 */
	async execute(params: NativeToolArgs["stop_service"], _task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { handleError, pushToolResult } = callbacks
		const serviceId =
			params.service_id && typeof params.service_id === "string" && params.service_id.trim() !== ""
				? params.service_id.trim()
				: undefined

		try {
			// 如果没有指定 service_id，返回错误
			if (!serviceId) {
				// 获取所有运行中的服务
				const runningServices = ServiceManager.getRunningServices()
				if (runningServices.length === 0) {
					pushToolResult(t("tools:stop_service.no_services"))
					return
				}

				// 返回服务列表，提示用户选择
				const serviceList = runningServices.map((s) => ({
					serviceId: s.serviceId,
					command: s.command,
					status: s.status,
					pid: s.pid,
				}))

				pushToolResult(
					[
						t("tools:stop_service.service_id_required"),
						"",
						t("tools:stop_service.available_services"),
						"",
						...serviceList.map(
							(s) => `- ${s.serviceId}: ${s.command} (${s.status}, PID: ${s.pid || "N/A"})`,
						),
						"",
						t("tools:stop_service.usage_hint"),
					].join("\n"),
				)
				return
			}

			// 检查服务是否存在
			const service = ServiceManager.getService(serviceId)
			if (!service) {
				// 如果服务不存在，先列出所有可用服务
				const runningServices = ServiceManager.getRunningServices()
				const availableServices = runningServices.map((s) => s.serviceId).join(", ")
				pushToolResult(
					[
						t("tools:stop_service.service_not_found", { serviceId }),
						"",
						availableServices.length > 0
							? `Available service IDs: ${availableServices}`
							: "No services are currently running.",
					].join("\n"),
				)
				return
			}

			// 记录服务信息
			const serviceInfo = {
				serviceId: service.serviceId,
				command: service.command,
				status: service.status,
				pid: service.pid,
			}

			// 停止服务
			try {
				await ServiceManager.stopService(serviceId)

				// 等待一小段时间确保状态更新
				await new Promise((resolve) => setTimeout(resolve, 500))

				// 检查服务是否真的停止了
				const updatedService = ServiceManager.getService(serviceId)

				if (!updatedService || updatedService.status === "stopped") {
					pushToolResult(
						[
							t("tools:stop_service.success", { serviceId }),
							"",
							`Command: ${serviceInfo.command}`,
							`PID: ${serviceInfo.pid || "N/A"}`,
							`Previous Status: ${serviceInfo.status}`,
							`Current Status: stopped`,
						].join("\n"),
					)
				} else if (updatedService.status === "failed") {
					pushToolResult(
						[
							t("tools:stop_service.partial_success", { serviceId }),
							"",
							`Command: ${serviceInfo.command}`,
							`PID: ${serviceInfo.pid || "N/A"}`,
							`Current Status: ${updatedService.status}`,
							"",
							"Note: The service may not have fully terminated. Check the process manually if needed.",
						].join("\n"),
					)
				} else {
					pushToolResult(
						[
							t("tools:stop_service.stopping", { serviceId }),
							"",
							`Command: ${serviceInfo.command}`,
							`PID: ${serviceInfo.pid || "N/A"}`,
							`Current Status: ${updatedService.status}`,
							"",
							"Note: The service is being stopped. This may take a few seconds.",
						].join("\n"),
					)
				}
			} catch (stopError) {
				const errorMessage = stopError instanceof Error ? stopError.message : String(stopError)
				pushToolResult(
					[
						t("tools:stop_service.error", { serviceId, error: errorMessage }),
						"",
						`Command: ${serviceInfo.command}`,
						`PID: ${serviceInfo.pid || "N/A"}`,
						"",
						"If the process is still running, try stopping it manually:",
						`Windows: taskkill /PID ${serviceInfo.pid} /T /F`,
						`Linux/Mac: kill -9 ${serviceInfo.pid}`,
					].join("\n"),
				)
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			await handleError("stopping service", new Error(errorMessage))
			pushToolResult(`Error stopping service: ${errorMessage}`)
		}
	}
}

// 导出单例实例
export const stopServiceTool = new StopServiceTool()
