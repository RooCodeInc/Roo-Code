/**
 * get_service_logs 工具的系统提示描述
 *
 * 这个工具允许 AI 获取后台服务的日志输出，用于调试和监控。
 */

import { ToolArgs } from "./types"

export function getGetServiceLogsDescription(_args: ToolArgs): string {
	return `## get_service_logs
Description: Get logs from a background service that was started with execute_command. This is useful for debugging and monitoring services that are running in the background (like development servers, docker containers, etc.).

IMPORTANT: To get logs from a service, you MUST provide the service_id parameter. If you don't know the service_id, first call this tool without service_id to list all running services, then call it again with the service_id to get the logs.

Parameters:
- service_id: (optional) The ID of the service to get logs from. If not provided, lists all running services and their IDs. To get actual logs, you MUST provide a valid service_id.
- max_lines: (optional) Maximum number of log lines to return (default: 100).

Usage:
<get_service_logs>
<service_id>service-1</service_id>
<max_lines>50</max_lines>
</get_service_logs>

Example - List all running services (to find service_id):
<get_service_logs>
</get_service_logs>

Example - Get logs from a specific service (REQUIRED to get actual logs):
<get_service_logs>
<service_id>service-1</service_id>
</get_service_logs>`
}
