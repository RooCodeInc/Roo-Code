# Quick Start Guide

Get your AI Chat Platform up and running in minutes!

## Prerequisites

- GCP account with billing enabled
- `gcloud`, `kubectl`, `terraform`, and `docker` installed
- API keys for Anthropic and Google AI

## 🚀 Quick Deployment (5 Steps)

### 1. Set Environment Variables

```bash
export GCP_PROJECT_ID="your-gcp-project-id"
export GCP_REGION="us-central1"
export ANTHROPIC_API_KEY="your-anthropic-api-key"
export GOOGLE_AI_API_KEY="your-google-ai-key"
```

### 2. Configure Environment

```bash
cd Gemini-private
cp config/.env.template .env
# Edit .env with your configuration
```

### 3. Deploy Infrastructure

```bash
cd infrastructure/terraform
terraform init
terraform apply -var="project_id=$GCP_PROJECT_ID" -var="environment=production"
cd ../..
```

### 4. Deploy Application

```bash
./scripts/deployment/deploy.sh production --infra --migrate
```

### 5. Access Your Platform

```bash
# Get the external IP
kubectl get ingress ai-chat-ingress

# Open in browser
# http://<EXTERNAL-IP>
```

## 🧪 Local Development

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Manual Setup

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn api.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 📚 Next Steps

1. **Create Admin User**: See [Deployment Guide](docs/DEPLOYMENT.md#create-admin-user)
2. **Configure DNS**: Point your domain to the external IP
3. **Set Up Monitoring**: Review [Support Documentation](docs/SUPPORT.md)
4. **Read User Guide**: Share [User Guide](docs/USER_GUIDE.md) with users
5. **Configure Backups**: Set up automated backups (see below)

## 🔄 Common Operations

### Viewing Logs

```bash
# Backend logs
kubectl logs -f deployment/ai-chat-backend

# Frontend logs
kubectl logs -f deployment/ai-chat-frontend

# All logs
kubectl logs -f -l app=ai-chat-backend
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment ai-chat-backend --replicas=10

# Auto-scaling is configured via HPA
kubectl get hpa
```

### Updates

```bash
# Build and push new image
docker build -f docker/Dockerfile.backend -t gcr.io/$GCP_PROJECT_ID/ai-chat-backend:latest .
docker push gcr.io/$GCP_PROJECT_ID/ai-chat-backend:latest

# Update deployment
kubectl set image deployment/ai-chat-backend backend=gcr.io/$GCP_PROJECT_ID/ai-chat-backend:latest

# Monitor rollout
kubectl rollout status deployment/ai-chat-backend
```

### Backups

```bash
# Manual backup
./scripts/backup/backup.sh

# Restore from backup
./scripts/backup/restore.sh <timestamp>
```

## 🔧 Configuration

### Required Secrets

```bash
# Application secrets
kubectl create secret generic app-secrets \
  --from-literal=database-url="$DATABASE_URL" \
  --from-literal=redis-url="$REDIS_URL" \
  --from-literal=jwt-secret="$(openssl rand -hex 32)"

# AI API keys
kubectl create secret generic ai-api-keys \
  --from-literal=anthropic-api-key="$ANTHROPIC_API_KEY" \
  --from-literal=google-ai-api-key="$GOOGLE_AI_API_KEY"
```

### Optional: Ping SSO

```bash
kubectl create secret generic sso-secrets \
  --from-literal=ping-client-id="$PING_CLIENT_ID" \
  --from-literal=ping-client-secret="$PING_CLIENT_SECRET"
```

## 🐛 Troubleshooting

### Pods not starting?

```bash
kubectl get pods
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

### Database connection issues?

```bash
# Check Cloud SQL status
gcloud sql instances describe ai-chat-platform-postgres

# Test connection
kubectl exec -it deployment/ai-chat-backend -- nc -zv <DB_IP> 5432
```

### High latency?

```bash
# Check resources
kubectl top pods
kubectl top nodes

# Scale up
kubectl scale deployment ai-chat-backend --replicas=10
```

## 📖 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [User Guide](docs/USER_GUIDE.md)
- [Support Documentation](docs/SUPPORT.md)

## 💰 Cost Optimization

For development:
```bash
# Use smaller instances
terraform apply -var="gke_machine_type=n2-standard-2" -var="environment=development"

# Scale down
kubectl scale deployment ai-chat-backend --replicas=1
```

## 🔒 Security Checklist

- [ ] Change default JWT secret
- [ ] Configure HTTPS with SSL certificate
- [ ] Set up Cloud Armor (DDoS protection)
- [ ] Enable audit logging
- [ ] Configure network policies
- [ ] Set up Secret Manager
- [ ] Regular security updates

## 🆘 Getting Help

- **Documentation**: Check `docs/` folder
- **Issues**: Review common issues in [Support Documentation](docs/SUPPORT.md)
- **Support**: Contact your system administrator

## 🎯 Production Readiness Checklist

- [ ] Infrastructure deployed via Terraform
- [ ] Database backups configured and tested
- [ ] Monitoring and alerts set up
- [ ] HTTPS enabled with valid certificates
- [ ] Auto-scaling configured
- [ ] Disaster recovery plan documented
- [ ] Security audit completed
- [ ] Load testing performed
- [ ] Documentation reviewed and updated
- [ ] Team trained on operations

---

**Ready to deploy? Let's go! 🚀**

```bash
./scripts/deployment/deploy.sh production --infra --migrate
```
