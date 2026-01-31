# Example Service Runbook

This is an example service-specific runbook. Replace with your actual service details.

## Service Overview

- **Service Name:** Example API Service
- **Owner:** Platform Team
- **Dependencies:**
    - Database Service
    - Cache Service
    - Auth Service
- **Critical Paths:**
    - User authentication
    - Payment processing
    - Data retrieval

## Common Issues

### Issue 1: High Error Rate

**Symptoms:**

- Error rate > 1%
- Increased latency
- User reports of failures

**Diagnosis:**

1. Check error rate metrics via monitoring MCP
2. Review error logs for patterns
3. Check recent deployments
4. Verify database connectivity

**Resolution:**

1. Identify root cause from logs
2. If deployment-related: Consider rollback
3. If resource-related: Scale up resources
4. If code-related: Apply hotfix
5. Monitor metrics to confirm resolution

**MCP Tools:**

- Use `monitoring` MCP `query_metrics` to check error rates
- Use `deployment` MCP `list_recent_deployments` to check changes
- Use `database` MCP `check_connection` to verify DB status

### Issue 2: Database Connection Pool Exhausted

**Symptoms:**

- Timeout errors
- Slow response times
- Database connection errors in logs

**Diagnosis:**

1. Check database connection pool metrics
2. Review connection pool configuration
3. Check for connection leaks
4. Verify database server status

**Resolution:**

1. Increase connection pool size if needed
2. Restart service to clear stale connections
3. Fix connection leaks in code
4. Scale database if resource-constrained

**MCP Tools:**

- Use `database` MCP `check_pool_status` to view connections
- Use `monitoring` MCP `query_metrics` for pool metrics

## Health Checks

### Quick Health Check

- Endpoint: `GET /health`
- Expected: `{"status": "healthy"}`
- MCP Tool: Use `monitoring` MCP `check_health_endpoint`

### Deep Health Check

1. Health endpoint responds
2. Database connectivity
3. Cache connectivity
4. All critical dependencies reachable
5. Error rate within normal range

## Restart Procedures

### Graceful Restart

1. Drain traffic from instance (if load balanced)
2. Wait for in-flight requests to complete
3. Stop service gracefully
4. Start new instance
5. Verify health
6. Resume traffic

**MCP Tools:**

- Use `deployment` MCP `restart_service` with graceful flag

### Emergency Restart

1. Stop service immediately
2. Start new instance
3. Verify health
4. Monitor for issues

**MCP Tools:**

- Use `deployment` MCP `restart_service` with force flag

## Rollback Procedures

### How to Rollback

1. Identify last known good deployment
2. Use deployment MCP to rollback
3. Verify service health after rollback
4. Monitor metrics closely

**MCP Tools:**

- Use `deployment` MCP `list_deployments` to find version
- Use `deployment` MCP `rollback_deployment` to rollback

### Rollback Verification

- Health endpoint returns healthy
- Error rate returns to normal
- Key metrics within expected range
- No user reports of issues

## Monitoring

### Key Metrics

- **Request Rate**: Normal: 1000-5000 req/min
- **Error Rate**: Normal: < 0.1%
- **Latency (p95)**: Normal: < 200ms
- **Database Connections**: Normal: 10-50 active

### Alert Thresholds

- **High Error Rate**: > 1% for 5 minutes
- **High Latency**: p95 > 500ms for 5 minutes
- **Service Down**: Health check fails for 2 minutes

## Contacts

### Service Owner

- Name: Platform Team
- Contact: #platform-team Slack channel

### Oncall Rotation

- Check PagerDuty for current oncall engineer
- Use `paging` MCP `get_current_oncall` to find oncall

## Related Documentation

- Architecture docs: `/docs/architecture/api-service.md`
- Deployment guide: `/docs/deployment/api-service.md`
- Monitoring dashboard: [Link to dashboard]
