# Support Documentation

Comprehensive support guide for the AI Chat Platform operations team.

## Table of Contents

1. [System Overview](#system-overview)
2. [Monitoring](#monitoring)
3. [Common Issues](#common-issues)
4. [Maintenance Procedures](#maintenance-procedures)
5. [Incident Response](#incident-response)
6. [Escalation](#escalation)

## System Overview

### Architecture Components

- **Frontend**: React application (Cloud Run/GKE)
- **Backend API**: FastAPI microservices (GKE)
- **Database**: Cloud SQL PostgreSQL with pgvector
- **Cache**: Memorystore Redis
- **Storage**: Cloud Storage (documents)
- **Container Registry**: GCR
- **Orchestration**: Google Kubernetes Engine (GKE)

### Service Dependencies

```
User → Load Balancer → Ingress → Frontend/Backend
                                      ↓
                              ┌───────┴───────┐
                              ↓               ↓
                         PostgreSQL        Redis
                              ↓
                         Vector Store
```

### Critical Services

1. **Backend API** (Tier 1)
   - Health endpoint: `/health`
   - Expected response: `{"status": "healthy"}`
   - SLA: 99.9% uptime

2. **Cloud SQL** (Tier 1)
   - Connection: Private IP
   - High Availability: Enabled (production)
   - Backups: Daily + PITR

3. **Redis** (Tier 2)
   - Mode: Standard HA (production)
   - Persistence: Enabled

## Monitoring

### Health Checks

**Backend API:**
```bash
kubectl exec -it deployment/ai-chat-backend -- curl localhost:8000/health
```

**Database:**
```bash
gcloud sql operations list --instance=ai-chat-platform-postgres --limit=10
```

**Redis:**
```bash
gcloud redis instances describe ai-chat-platform-redis --region=us-central1
```

### Key Metrics

#### Application Metrics

Monitor in Cloud Console → Monitoring

- **Request Rate**: Requests per second
  - Normal: 100-1000 req/s
  - Alert: > 5000 req/s

- **Response Time**: p95 latency
  - Normal: < 200ms
  - Warning: 200-500ms
  - Critical: > 500ms

- **Error Rate**: HTTP 5xx errors
  - Normal: < 0.1%
  - Warning: 0.1-1%
  - Critical: > 1%

#### Infrastructure Metrics

- **Pod CPU**: CPU utilization
  - Normal: 30-70%
  - Warning: 70-90%
  - Critical: > 90%

- **Pod Memory**: Memory utilization
  - Normal: 40-70%
  - Warning: 70-85%
  - Critical: > 85%

- **Database Connections**: Active connections
  - Normal: 10-50
  - Warning: 50-150
  - Critical: > 150

### Dashboards

Access via Cloud Console → Monitoring → Dashboards

1. **System Overview**: Overall health
2. **API Performance**: Request metrics
3. **Database Performance**: Query metrics
4. **Infrastructure**: Resource utilization

### Alerts

Configured alerts (see `kubernetes/monitoring/alerts.yaml`):

- High error rate (> 1% for 5 minutes)
- High latency (p95 > 500ms for 5 minutes)
- Pod crashes (> 3 restarts in 10 minutes)
- Database connection failures
- High CPU/Memory (> 85% for 10 minutes)

## Common Issues

### Issue: Pods Not Starting

**Symptoms:**
- Pods in CrashLoopBackOff
- Pods in ImagePullBackOff
- Pods in Pending state

**Diagnosis:**
```bash
kubectl get pods
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

**Resolution:**

1. **CrashLoopBackOff:**
   ```bash
   # Check logs
   kubectl logs <pod-name> --previous

   # Common causes:
   # - Database connection failure → Check secrets
   # - Missing environment variables → Verify ConfigMap
   # - Application error → Check logs
   ```

2. **ImagePullBackOff:**
   ```bash
   # Verify image exists
   gcloud container images list --repository=gcr.io/$PROJECT_ID

   # Check node permissions
   kubectl describe node <node-name>
   ```

3. **Pending:**
   ```bash
   # Check resources
   kubectl describe pod <pod-name>

   # Check nodes
   kubectl get nodes
   kubectl top nodes
   ```

### Issue: High Latency

**Symptoms:**
- Slow response times
- Timeout errors
- User complaints

**Diagnosis:**
```bash
# Check pod resources
kubectl top pods

# Check HPA status
kubectl get hpa

# Check database performance
gcloud sql operations list --instance=ai-chat-platform-postgres
```

**Resolution:**

1. **Scale up pods:**
   ```bash
   kubectl scale deployment ai-chat-backend --replicas=10
   ```

2. **Check database:**
   ```bash
   # Check slow queries
   # Connect to database and run:
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

3. **Check Redis:**
   ```bash
   # Verify Redis is responding
   kubectl exec -it deployment/ai-chat-backend -- redis-cli -h $REDIS_HOST ping
   ```

### Issue: Database Connection Failures

**Symptoms:**
- "Could not connect to database" errors
- Backend pods crashing
- 500 errors in API

**Diagnosis:**
```bash
# Check Cloud SQL status
gcloud sql instances describe ai-chat-platform-postgres

# Test connectivity from pod
kubectl exec -it deployment/ai-chat-backend -- nc -zv $DB_HOST 5432

# Check secrets
kubectl get secret app-secrets -o yaml
```

**Resolution:**

1. **Verify Cloud SQL is running:**
   ```bash
   gcloud sql instances list
   ```

2. **Check connection string:**
   ```bash
   kubectl get secret app-secrets -o jsonpath='{.data.database-url}' | base64 -d
   ```

3. **Restart pods:**
   ```bash
   kubectl rollout restart deployment/ai-chat-backend
   ```

### Issue: High Memory Usage

**Symptoms:**
- OOMKilled pods
- Slow performance
- Pod evictions

**Diagnosis:**
```bash
kubectl top pods
kubectl describe pod <pod-name>
```

**Resolution:**

1. **Increase memory limits:**
   ```yaml
   # Update deployment.yaml
   resources:
     limits:
       memory: "4Gi"  # Increase from 2Gi
   ```

2. **Check for memory leaks:**
   ```bash
   kubectl logs <pod-name> | grep -i "memory"
   ```

3. **Scale horizontally:**
   ```bash
   kubectl scale deployment ai-chat-backend --replicas=10
   ```

## Maintenance Procedures

### Routine Maintenance

#### Daily Tasks

- [ ] Check dashboard for anomalies
- [ ] Review error logs
- [ ] Verify backup completion
- [ ] Check disk space

#### Weekly Tasks

- [ ] Review performance metrics
- [ ] Check for security updates
- [ ] Test backup restore (sample)
- [ ] Review access logs

#### Monthly Tasks

- [ ] Full system health check
- [ ] Capacity planning review
- [ ] Security audit
- [ ] Documentation updates
- [ ] Disaster recovery test

### Update Procedures

#### Application Updates

```bash
# Build new image
docker build -f docker/Dockerfile.backend -t gcr.io/$PROJECT_ID/ai-chat-backend:v2 .

# Push image
docker push gcr.io/$PROJECT_ID/ai-chat-backend:v2

# Update deployment
kubectl set image deployment/ai-chat-backend backend=gcr.io/$PROJECT_ID/ai-chat-backend:v2

# Monitor rollout
kubectl rollout status deployment/ai-chat-backend

# Rollback if needed
kubectl rollout undo deployment/ai-chat-backend
```

#### Infrastructure Updates

```bash
cd infrastructure/terraform

# Update Terraform files
# ...

# Plan changes
terraform plan -var="project_id=$PROJECT_ID" -out=tfplan

# Review and apply
terraform apply tfplan
```

### Database Maintenance

#### Vacuum and Analyze

```sql
-- Connect to database
\c ai_chat_platform

-- Vacuum
VACUUM ANALYZE;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Index Maintenance

```sql
-- Check index usage
SELECT
  schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Rebuild indexes if needed
REINDEX TABLE table_name;
```

## Incident Response

### Severity Levels

**P0 - Critical (< 15 min response)**
- Complete system outage
- Data loss
- Security breach

**P1 - High (< 1 hour)**
- Major feature unavailable
- Severe performance degradation
- High error rates

**P2 - Medium (< 4 hours)**
- Minor feature issue
- Moderate performance degradation

**P3 - Low (< 1 business day)**
- Cosmetic issues
- Feature requests

### Incident Response Flow

1. **Detection**: Alert fires or user report
2. **Triage**: Assess severity and impact
3. **Response**: Assign to on-call engineer
4. **Mitigation**: Implement fix or workaround
5. **Communication**: Update stakeholders
6. **Resolution**: Confirm fix deployed
7. **Post-mortem**: Document and review

### On-Call Procedures

#### When Alert Fires

1. **Acknowledge** alert within 5 minutes
2. **Assess** severity and impact
3. **Investigate** using runbooks
4. **Mitigate** or **escalate**
5. **Document** actions taken
6. **Resolve** and update status page

#### Communication Template

```
Subject: [INCIDENT] Brief description

Status: INVESTIGATING/IDENTIFIED/MONITORING/RESOLVED
Severity: P0/P1/P2/P3
Start Time: YYYY-MM-DD HH:MM UTC
Impact: Description of user impact

Current Status:
- What we know
- What we're doing
- When to expect update

Next Update: In X minutes
```

## Escalation

### Escalation Path

1. **L1 - On-Call Engineer**: First responder
2. **L2 - Senior Engineer**: Complex issues
3. **L3 - Engineering Lead**: Critical incidents
4. **L4 - CTO/VP Engineering**: Major outages

### Contact Information

```
L1 On-Call: [PagerDuty/Phone]
L2 Senior Engineer: [Contact]
L3 Engineering Lead: [Contact]
L4 Executive: [Contact]

External Vendors:
- GCP Support: [Case Portal]
- Anthropic Support: [Email]
- Google AI Support: [Email]
```

### When to Escalate

- Unable to resolve within SLA
- Requires elevated permissions
- Potential security incident
- Requires vendor involvement
- Data loss or corruption

## Reference

### Quick Commands

```bash
# Get pod logs
kubectl logs -f deployment/ai-chat-backend

# Exec into pod
kubectl exec -it deployment/ai-chat-backend -- bash

# Check resource usage
kubectl top pods
kubectl top nodes

# Scale deployment
kubectl scale deployment ai-chat-backend --replicas=10

# Restart deployment
kubectl rollout restart deployment/ai-chat-backend

# Check events
kubectl get events --sort-by='.lastTimestamp'

# Port forward for debugging
kubectl port-forward deployment/ai-chat-backend 8000:8000
```

### Log Locations

- **Application Logs**: Cloud Logging
- **Database Logs**: Cloud SQL Logs
- **Audit Logs**: Cloud Audit Logs
- **Access Logs**: Load Balancer Logs

### Configuration Files

- **Kubernetes**: `kubernetes/base/`
- **Terraform**: `infrastructure/terraform/`
- **Environment**: `config/.env.template`
- **Docker**: `docker/`

---

For additional support, contact the engineering team or refer to the runbooks in `docs/runbooks/`.
