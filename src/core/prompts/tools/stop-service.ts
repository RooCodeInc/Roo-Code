/**
 * stop_service 工具的系统提示描述
 *
 * 这个工具允许 AI 停止后台服务，正确终止进程树以确保服务完全停止。
 */

import { ToolArgs } from "./types"

export function getStopServiceDescription(_args: ToolArgs): string {
	return `## stop_service
Description: Stop a background service that was started with execute_command. This tool properly terminates the process tree to ensure the service and all its child processes are stopped.

IMPORTANT: 
- You MUST provide the service_id parameter to stop a service.
- If you don't know the service_id, use get_service_logs without parameters to list all running services first.
- Do NOT try to stop services manually using taskkill or kill commands - use this tool instead for proper process tree termination.

Parameters:
- service_id: (required) The ID of the service to stop. Use get_service_logs without parameters to list all running services and find the service_id.

Usage:
<stop_service>
<service_id>service-1</service_id>
</stop_service>

Example - Stop a service:
<stop_service>
<service_id>service-1</service_id>
</stop_service>`
}
