# Kubernetes Troubleshooting Workflow

This workflow guides you through troubleshooting Kubernetes-related incidents.

## Step 1: Assess the Situation

### 1.1 Gather Initial Information

- Identify which namespace/service is affected
- Check if it's a pod, deployment, service, or ingress issue
- Determine the severity and user impact

**Actions:**

- Use MCP tools to query cluster status
- Check recent deployments or changes
- Review alert details

### 1.2 Check Pod Status

Use MCP tools or commands to check pod status:

**MCP Actions:**

- Use `k8s` MCP server `list_pods` to see pod status
- Use `k8s` MCP server `get_pod_logs` to check recent logs
- Use `k8s` MCP server `describe_pod` for detailed pod information

**Manual Commands (if MCP not available):**

```bash
kubectl get pods -n <namespace>
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace> --tail=100
```

## Step 2: Diagnose the Issue

### 2.1 Check Pod States

Identify the pod state:

- **Pending**: Pod can't be scheduled
- **CrashLoopBackOff**: Pod keeps crashing
- **ImagePullBackOff**: Can't pull container image
- **Running but unhealthy**: Pod running but failing health checks
- **Terminating**: Pod stuck in termination

### 2.2 Common Issues and Solutions

#### Issue: Pod in CrashLoopBackOff

**Diagnosis:**

1. Check pod logs for errors
2. Review container exit codes
3. Check resource limits
4. Verify environment variables and configs

**Resolution:**

- Fix application errors in logs
- Adjust resource requests/limits if OOMKilled
- Fix configuration issues
- Check for missing dependencies or secrets

**MCP Actions:**

- Use `k8s` MCP `get_pod_logs` to view crash logs
- Use `k8s` MCP `get_pod_events` to see recent events

#### Issue: ImagePullBackOff

**Diagnosis:**

1. Check if image exists and is accessible
2. Verify image pull secrets
3. Check network connectivity to registry

**Resolution:**

- Verify image tag exists
- Add/update imagePullSecrets if needed
- Check registry authentication
- Verify network policies allow registry access

**MCP Actions:**

- Use `k8s` MCP `describe_pod` to see image pull errors
- Use `k8s` MCP `list_secrets` to check image pull secrets

#### Issue: Pod Pending

**Diagnosis:**

1. Check node resources (CPU, memory)
2. Review node selectors and affinity rules
3. Check for taints and tolerations
4. Verify persistent volume claims

**Resolution:**

- Scale cluster if resources exhausted
- Adjust node selectors/affinity
- Add tolerations if needed
- Fix PVC issues

**MCP Actions:**

- Use `k8s` MCP `describe_pod` to see scheduling events
- Use `k8s` MCP `get_nodes` to check node resources
- Use `k8s` MCP `get_pvc` to check volume claims

#### Issue: Service Not Accessible

**Diagnosis:**

1. Check service endpoints
2. Verify service selector matches pod labels
3. Check ingress configuration
4. Review network policies

**Resolution:**

- Fix label mismatches
- Update service selectors
- Fix ingress rules
- Adjust network policies

**MCP Actions:**

- Use `k8s` MCP `get_service_endpoints` to check endpoints
- Use `k8s` MCP `describe_service` for service details
- Use `k8s` MCP `get_ingress` to check ingress rules

## Step 3: Check Resource Constraints

### 3.1 Resource Limits

Check if pods are hitting resource limits:

**MCP Actions:**

- Use `k8s` MCP `get_pod_metrics` to see current usage
- Use `k8s` MCP `describe_pod` to check limits/requests

**Manual Commands:**

```bash
kubectl top pod <pod-name> -n <namespace>
kubectl describe pod <pod-name> -n <namespace> | grep -A 5 "Limits\|Requests"
```

### 3.2 Node Resources

Check cluster-wide resource availability:

**MCP Actions:**

- Use `k8s` MCP `get_node_metrics` to see node usage
- Use `k8s` MCP `get_nodes` to check allocatable resources

## Step 4: Check Dependencies

### 4.1 ConfigMaps and Secrets

Verify required configs and secrets exist:

**MCP Actions:**

- Use `k8s` MCP `get_configmap` to check configs
- Use `k8s` MCP `get_secret` to verify secrets

**Manual Commands:**

```bash
kubectl get configmap -n <namespace>
kubectl get secret -n <namespace>
```

### 4.2 Service Dependencies

Check if dependent services are running:

**MCP Actions:**

- Use `k8s` MCP `list_services` to see all services
- Use `k8s` MCP `get_service_endpoints` to verify endpoints

## Step 5: Review Recent Changes

### 5.1 Check Deployment History

Look for recent changes that might have caused the issue:

**MCP Actions:**

- Use `k8s` MCP `get_deployment_history` to see rollout history
- Use `k8s` MCP `get_events` to see recent cluster events

**Manual Commands:**

```bash
kubectl rollout history deployment/<deployment-name> -n <namespace>
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
```

### 5.2 Rollback if Needed

If recent deployment caused the issue:

**MCP Actions:**

- Use `k8s` MCP `rollback_deployment` to rollback

**Manual Commands:**

```bash
kubectl rollout undo deployment/<deployment-name> -n <namespace>
```

## Step 6: Verify Resolution

### 6.1 Check Pod Status

Verify pods are running and healthy:

**MCP Actions:**

- Use `k8s` MCP `list_pods` to verify status
- Use `k8s` MCP `get_pod_metrics` to check resource usage

### 6.2 Test Functionality

- Verify service endpoints respond
- Check application logs for errors
- Test critical user flows

**MCP Actions:**

- Use `k8s` MCP `port_forward` to test locally if needed
- Use monitoring MCP to check service metrics

## Step 7: Document Resolution

### 7.1 Update Incident Log

Create or update incident log: `incidents/YYYY-MM-DD-HHMM-k8s-<issue>.md`

Include:

- Root cause
- Steps taken to resolve
- Any rollbacks performed
- Follow-up actions needed

### 7.2 Update Runbooks

If this was a new issue pattern:

- Add to service-specific runbook
- Document the solution for future reference

## Quick Reference Commands

```bash
# Get pod status
kubectl get pods -n <namespace>

# Describe pod details
kubectl describe pod <pod-name> -n <namespace>

# View logs
kubectl logs <pod-name> -n <namespace> --tail=100 -f

# Check events
kubectl get events -n <namespace> --sort-by='.lastTimestamp'

# Check resource usage
kubectl top pod <pod-name> -n <namespace>

# Check service endpoints
kubectl get endpoints <service-name> -n <namespace>

# Rollback deployment
kubectl rollout undo deployment/<deployment-name> -n <namespace>

# Scale deployment
kubectl scale deployment/<deployment-name> --replicas=<count> -n <namespace>
```

## Common MCP Tools Reference

If you have a Kubernetes MCP server configured, use these tools:

- `k8s_list_pods` - List pods in namespace
- `k8s_get_pod_logs` - Get pod logs
- `k8s_describe_pod` - Get detailed pod information
- `k8s_get_pod_events` - Get events for a pod
- `k8s_get_service_endpoints` - Check service endpoints
- `k8s_rollback_deployment` - Rollback a deployment
- `k8s_get_nodes` - Check node status and resources
- `k8s_get_pvc` - Check persistent volume claims
