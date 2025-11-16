# Deployment Guide

Complete guide for deploying the AI Chat Platform to Google Cloud Platform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Deployment Steps](#detailed-deployment-steps)
4. [Configuration](#configuration)
5. [Post-Deployment](#post-deployment)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Google Cloud SDK (gcloud)**: `>= 450.0.0`
- **kubectl**: `>= 1.28.0`
- **Terraform**: `>= 1.5.0`
- **Docker**: `>= 24.0.0`
- **Node.js**: `>= 18.0.0` (for local development)
- **Python**: `>= 3.11` (for local development)

### GCP Account Requirements

- Active GCP project with billing enabled
- Necessary IAM permissions:
  - `roles/owner` (or equivalent permissions)
  - `roles/iam.serviceAccountAdmin`
  - `roles/container.admin`
  - `roles/compute.admin`
  - `roles/cloudsql.admin`

### Required API Keys

- **Anthropic API Key**: For Claude models
- **Google AI API Key**: For Gemini models
- **Google Custom Search API Key** (optional): For web grounding
- **Ping SSO Credentials** (optional): For enterprise SSO

## Quick Start

### 1. Clone and Configure

```bash
cd Gemini-private

# Set environment variables
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"
export ANTHROPIC_API_KEY="your-anthropic-key"
export GOOGLE_AI_API_KEY="your-google-ai-key"
```

### 2. Deploy Infrastructure

```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Create infrastructure
terraform apply \
  -var="project_id=$GCP_PROJECT_ID" \
  -var="environment=production"
```

### 3. Deploy Application

```bash
# Return to project root
cd ../..

# Make deployment script executable
chmod +x scripts/deployment/deploy.sh

# Run deployment
./scripts/deployment/deploy.sh production --infra --migrate
```

### 4. Access the Application

After deployment completes, get the external IP:

```bash
kubectl get ingress ai-chat-ingress
```

Navigate to the displayed IP address or configured domain.

## Detailed Deployment Steps

### Step 1: GCP Project Setup

```bash
# Set your project
gcloud config set project $GCP_PROJECT_ID

# Enable required APIs (automated in Terraform, but can be done manually)
gcloud services enable \
  container.googleapis.com \
  compute.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  servicenetworking.googleapis.com \
  aiplatform.googleapis.com
```

### Step 2: Terraform Backend Setup

Create a GCS bucket for Terraform state:

```bash
gsutil mb -p $GCP_PROJECT_ID -l $GCP_REGION gs://${GCP_PROJECT_ID}-terraform-state
gsutil versioning set on gs://${GCP_PROJECT_ID}-terraform-state
```

Update `infrastructure/terraform/main.tf` backend configuration:

```hcl
backend "gcs" {
  bucket = "YOUR-PROJECT-ID-terraform-state"
  prefix = "terraform/state"
}
```

### Step 3: Infrastructure Deployment

```bash
cd infrastructure/terraform

# Initialize
terraform init

# Review plan
terraform plan \
  -var="project_id=$GCP_PROJECT_ID" \
  -var="environment=production" \
  -out=tfplan

# Apply
terraform apply tfplan

# Save outputs
terraform output -json > outputs.json
```

### Step 4: Build Docker Images

```bash
cd ../..

# Configure Docker for GCR
gcloud auth configure-docker

# Build backend
docker build -f docker/Dockerfile.backend \
  -t gcr.io/$GCP_PROJECT_ID/ai-chat-backend:latest .

# Build frontend
docker build -f docker/Dockerfile.frontend \
  -t gcr.io/$GCP_PROJECT_ID/ai-chat-frontend:latest .

# Push images
docker push gcr.io/$GCP_PROJECT_ID/ai-chat-backend:latest
docker push gcr.io/$GCP_PROJECT_ID/ai-chat-frontend:latest
```

### Step 5: Configure Kubernetes

```bash
# Get GKE credentials
gcloud container clusters get-credentials ai-chat-platform-gke \
  --region=$GCP_REGION \
  --project=$GCP_PROJECT_ID

# Create namespace (optional)
kubectl create namespace ai-chat-platform

# Create secrets
kubectl create secret generic app-secrets \
  --from-literal=database-url="$DATABASE_URL" \
  --from-literal=redis-url="$REDIS_URL" \
  --from-literal=jwt-secret="$(openssl rand -hex 32)"

kubectl create secret generic ai-api-keys \
  --from-literal=anthropic-api-key="$ANTHROPIC_API_KEY" \
  --from-literal=google-ai-api-key="$GOOGLE_AI_API_KEY"

# Create SSO secrets (if using Ping SSO)
kubectl create secret generic sso-secrets \
  --from-literal=ping-client-id="$PING_CLIENT_ID" \
  --from-literal=ping-client-secret="$PING_CLIENT_SECRET"
```

### Step 6: Deploy Application

```bash
# Update manifests with project ID
find kubernetes/base -name "*.yaml" -type f \
  -exec sed -i "s/PROJECT_ID/$GCP_PROJECT_ID/g" {} \;

# Apply Kubernetes resources
kubectl apply -f kubernetes/base/

# Verify deployment
kubectl get pods
kubectl get services
kubectl get ingress
```

### Step 7: Database Initialization

```bash
# Connect to Cloud SQL instance
gcloud sql connect ai-chat-platform-postgres \
  --user=app_user \
  --database=ai_chat_platform

# Run schema creation (from SQL file)
# Or use migration job in Kubernetes
```

## Configuration

### Environment Variables

Create a `.env` file for local development:

```env
# Application
ENV=development
DEBUG=true

# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/ai_chat_platform
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=your-secret-key-here

# AI APIs
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_AI_API_KEY=your-google-ai-key
VERTEX_AI_PROJECT=your-gcp-project
VERTEX_AI_LOCATION=us-central1

# Web Grounding (Optional)
GOOGLE_SEARCH_API_KEY=your-search-api-key
GOOGLE_SEARCH_ENGINE_ID=your-search-engine-id

# Ping SSO (Optional)
PING_SSO_ENABLED=true
PING_CLIENT_ID=your-client-id
PING_CLIENT_SECRET=your-client-secret
PING_AUTHORIZATION_ENDPOINT=https://your-ping-domain/as/authorization.oauth2
PING_TOKEN_ENDPOINT=https://your-ping-domain/as/token.oauth2
PING_USERINFO_ENDPOINT=https://your-ping-domain/idp/userinfo.openid
PING_REDIRECT_URI=https://your-domain/auth/callback
```

### Terraform Variables

Create `terraform.tfvars`:

```hcl
project_id       = "your-gcp-project-id"
project_name     = "ai-chat-platform"
region           = "us-central1"
environment      = "production"

# GKE
gke_num_nodes    = 3
gke_min_nodes    = 2
gke_max_nodes    = 10
gke_machine_type = "n2-standard-4"

# Database
db_tier          = "db-custom-4-16384"
db_disk_size     = 100

# Redis
redis_memory_size = 5
```

## Post-Deployment

### 1. Verify Services

```bash
# Check pod status
kubectl get pods -A

# Check service health
kubectl exec -it deployment/ai-chat-backend -- curl localhost:8000/health

# View logs
kubectl logs -f deployment/ai-chat-backend
```

### 2. Create Admin User

```bash
# Connect to backend pod
kubectl exec -it deployment/ai-chat-backend -- bash

# Create admin user (using Python)
python -c "
from backend.auth.service import AuthService
from backend.shared.models import UserCreate
from backend.shared.database import get_db
import asyncio

async def create_admin():
    async with get_db() as db:
        auth_service = AuthService(db)
        user = await auth_service.register_user(UserCreate(
            email='admin@example.com',
            username='admin',
            password='changeme123',
            auth_provider='local'
        ))
        print(f'Admin user created: {user.id}')

asyncio.run(create_admin())
"
```

### 3. Configure DNS

Point your domain to the Ingress external IP:

```bash
# Get external IP
EXTERNAL_IP=$(kubectl get ingress ai-chat-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Create DNS A record
# chat.yourdomain.com -> $EXTERNAL_IP
```

### 4. Enable HTTPS

Update ingress with your domain and enable managed certificates:

```yaml
# In kubernetes/base/ingress.yaml
spec:
  rules:
  - host: chat.yourdomain.com
```

## Scaling

### Manual Scaling

```bash
# Scale backend
kubectl scale deployment ai-chat-backend --replicas=5

# Scale frontend
kubectl scale deployment ai-chat-frontend --replicas=3
```

### Auto-scaling

HPA is configured in `kubernetes/base/hpa.yaml`. Adjust as needed:

```yaml
spec:
  minReplicas: 3
  maxReplicas: 20
```

## Monitoring

### View Metrics

```bash
# CPU and memory usage
kubectl top pods

# View events
kubectl get events --sort-by='.lastTimestamp'
```

### Cloud Monitoring

Access metrics in GCP Console:

1. Go to Operations > Monitoring
2. Navigate to Dashboards > GKE
3. View custom metrics for the application

## Backup and Recovery

### Database Backup

Automated backups are configured in Terraform. Manual backup:

```bash
gcloud sql backups create \
  --instance=ai-chat-platform-postgres \
  --project=$GCP_PROJECT_ID
```

### Restore from Backup

```bash
# List backups
gcloud sql backups list --instance=ai-chat-platform-postgres

# Restore
gcloud sql backups restore BACKUP_ID \
  --backup-instance=ai-chat-platform-postgres \
  --backup-project=$GCP_PROJECT_ID
```

## Troubleshooting

### Common Issues

#### Pods not starting

```bash
# Check pod status
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>

# Common causes:
# - Image pull errors: Check GCR permissions
# - Resource limits: Adjust resource requests/limits
# - Missing secrets: Verify secrets exist
```

#### Database connection errors

```bash
# Verify Cloud SQL is running
gcloud sql instances describe ai-chat-platform-postgres

# Check connectivity from pod
kubectl exec -it deployment/ai-chat-backend -- \
  nc -zv <CLOUD_SQL_PRIVATE_IP> 5432

# Verify database credentials in secrets
kubectl get secret app-secrets -o yaml
```

#### High latency

```bash
# Check HPA status
kubectl get hpa

# View pod resource usage
kubectl top pods

# Scale up if needed
kubectl scale deployment ai-chat-backend --replicas=10
```

### Getting Help

- Review logs: `kubectl logs -f deployment/ai-chat-backend`
- Check Cloud Console: [GCP Console](https://console.cloud.google.com)
- Review documentation in `docs/` directory
- Contact support team

## Rollback

### Application Rollback

```bash
# View deployment history
kubectl rollout history deployment/ai-chat-backend

# Rollback to previous version
kubectl rollout undo deployment/ai-chat-backend

# Rollback to specific revision
kubectl rollout undo deployment/ai-chat-backend --to-revision=2
```

### Infrastructure Rollback

```bash
cd infrastructure/terraform

# View previous state
terraform state list

# Revert changes
terraform apply -var="project_id=$GCP_PROJECT_ID" -var="environment=production"
```

## Maintenance

### Update Dependencies

```bash
# Backend
cd backend
pip install --upgrade -r requirements.txt

# Frontend
cd frontend
npm update
```

### Update Docker Images

```bash
# Rebuild and push new images
docker build -f docker/Dockerfile.backend \
  -t gcr.io/$GCP_PROJECT_ID/ai-chat-backend:v2 .
docker push gcr.io/$GCP_PROJECT_ID/ai-chat-backend:v2

# Update deployment
kubectl set image deployment/ai-chat-backend \
  backend=gcr.io/$GCP_PROJECT_ID/ai-chat-backend:v2
```

## Security Checklist

- [ ] Secrets stored in Secret Manager (not in code)
- [ ] HTTPS enabled with valid certificates
- [ ] Network policies configured
- [ ] Database encrypted at rest
- [ ] Regular security updates applied
- [ ] IAM roles follow principle of least privilege
- [ ] Audit logging enabled
- [ ] Backup and disaster recovery tested

## Performance Optimization

1. **Enable caching**: Redis configured for session and API response caching
2. **Database optimization**: Connection pooling, read replicas
3. **CDN**: Use Cloud CDN for static assets
4. **Image optimization**: Use multi-stage Docker builds
5. **Auto-scaling**: Configure HPA based on metrics

## Cost Optimization

1. **Right-size resources**: Monitor and adjust CPU/memory requests
2. **Use preemptible nodes**: For non-production environments
3. **Storage lifecycle**: Configure object lifecycle policies
4. **Autoscaling**: Scale down during low traffic
5. **Reserved instances**: Consider committed use discounts

## Next Steps

1. Review [User Guide](USER_GUIDE.md) for end-user documentation
2. Review [Support Documentation](SUPPORT.md) for operational procedures
3. Review [Runbooks](runbooks/) for common operational tasks
4. Set up monitoring alerts
5. Configure backup retention policies
6. Perform load testing
