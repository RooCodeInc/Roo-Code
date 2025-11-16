#!/bin/bash
set -e

# AI Chat Platform Deployment Script
# Usage: ./deploy.sh <environment> [options]

ENVIRONMENT=${1:-production}
PROJECT_ID=${GCP_PROJECT_ID:-""}
REGION=${GCP_REGION:-"us-central1"}
CLUSTER_NAME="ai-chat-platform-gke"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    echo_info "Checking prerequisites..."

    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        echo_error "gcloud CLI not found. Please install Google Cloud SDK."
        exit 1
    fi

    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        echo_error "kubectl not found. Please install kubectl."
        exit 1
    fi

    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        echo_error "Docker not found. Please install Docker."
        exit 1
    fi

    # Check if terraform is installed
    if ! command -v terraform &> /dev/null; then
        echo_warn "Terraform not found. Infrastructure deployment will be skipped."
    fi

    echo_info "Prerequisites check passed!"
}

# Authenticate with GCP
authenticate_gcp() {
    echo_info "Authenticating with GCP..."

    if [ -z "$PROJECT_ID" ]; then
        echo_error "GCP_PROJECT_ID environment variable not set."
        exit 1
    fi

    gcloud config set project "$PROJECT_ID"
    gcloud auth configure-docker

    echo_info "GCP authentication successful!"
}

# Deploy infrastructure with Terraform
deploy_infrastructure() {
    echo_info "Deploying infrastructure with Terraform..."

    cd infrastructure/terraform

    terraform init
    terraform plan -var="project_id=$PROJECT_ID" -var="environment=$ENVIRONMENT" -out=tfplan
    terraform apply tfplan

    echo_info "Infrastructure deployment complete!"

    cd ../..
}

# Build and push Docker images
build_and_push_images() {
    echo_info "Building and pushing Docker images..."

    # Build backend image
    echo_info "Building backend image..."
    docker build -f docker/Dockerfile.backend -t "gcr.io/$PROJECT_ID/ai-chat-backend:latest" .
    docker push "gcr.io/$PROJECT_ID/ai-chat-backend:latest"

    # Build frontend image
    echo_info "Building frontend image..."
    docker build -f docker/Dockerfile.frontend -t "gcr.io/$PROJECT_ID/ai-chat-frontend:latest" .
    docker push "gcr.io/$PROJECT_ID/ai-chat-frontend:latest"

    echo_info "Docker images built and pushed successfully!"
}

# Get GKE credentials
get_gke_credentials() {
    echo_info "Getting GKE cluster credentials..."

    gcloud container clusters get-credentials "$CLUSTER_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID"

    echo_info "GKE credentials obtained!"
}

# Create Kubernetes secrets
create_secrets() {
    echo_info "Creating Kubernetes secrets..."

    # Check if secrets already exist
    if kubectl get secret app-secrets &> /dev/null; then
        echo_warn "Secret 'app-secrets' already exists. Skipping..."
    else
        # Get database URL from Terraform output
        DB_CONNECTION=$(cd infrastructure/terraform && terraform output -raw database_connection_name)
        DB_PASSWORD=$(cd infrastructure/terraform && terraform output -raw database_password)
        REDIS_HOST=$(cd infrastructure/terraform && terraform output -raw redis_host)
        JWT_SECRET=$(cd infrastructure/terraform && terraform output -raw jwt_secret)

        DATABASE_URL="postgresql+asyncpg://app_user:$DB_PASSWORD@$DB_CONNECTION/ai_chat_platform"
        REDIS_URL="redis://$REDIS_HOST:6379/0"

        kubectl create secret generic app-secrets \
            --from-literal=database-url="$DATABASE_URL" \
            --from-literal=redis-url="$REDIS_URL" \
            --from-literal=jwt-secret="$JWT_SECRET"
    fi

    # Create AI API keys secret (should be set manually or from env)
    if kubectl get secret ai-api-keys &> /dev/null; then
        echo_warn "Secret 'ai-api-keys' already exists. Skipping..."
    else
        if [ -z "$ANTHROPIC_API_KEY" ] || [ -z "$GOOGLE_AI_API_KEY" ]; then
            echo_error "ANTHROPIC_API_KEY and GOOGLE_AI_API_KEY must be set."
            exit 1
        fi

        kubectl create secret generic ai-api-keys \
            --from-literal=anthropic-api-key="$ANTHROPIC_API_KEY" \
            --from-literal=google-ai-api-key="$GOOGLE_AI_API_KEY"
    fi

    echo_info "Secrets created successfully!"
}

# Deploy Kubernetes resources
deploy_kubernetes() {
    echo_info "Deploying Kubernetes resources..."

    # Update PROJECT_ID in manifests
    find kubernetes/base -name "*.yaml" -type f -exec sed -i "s/PROJECT_ID/$PROJECT_ID/g" {} \;

    # Apply Kubernetes manifests
    kubectl apply -f kubernetes/base/

    echo_info "Kubernetes resources deployed!"
}

# Run database migrations
run_migrations() {
    echo_info "Running database migrations..."

    # Deploy a one-time migration job
    kubectl create job migrate-$(date +%s) \
        --from=cronjob/db-migrations \
        --dry-run=client -o yaml | kubectl apply -f -

    echo_info "Database migrations initiated!"
}

# Verify deployment
verify_deployment() {
    echo_info "Verifying deployment..."

    # Wait for deployments to be ready
    kubectl wait --for=condition=available --timeout=300s \
        deployment/ai-chat-backend deployment/ai-chat-frontend

    # Get service endpoints
    echo_info "Getting service endpoints..."
    kubectl get ingress ai-chat-ingress

    echo_info "Deployment verification complete!"
}

# Main deployment flow
main() {
    echo_info "Starting deployment for environment: $ENVIRONMENT"

    check_prerequisites
    authenticate_gcp

    # Deploy infrastructure if --infra flag is set
    if [[ "$*" == *"--infra"* ]]; then
        deploy_infrastructure
    fi

    build_and_push_images
    get_gke_credentials
    create_secrets
    deploy_kubernetes

    # Run migrations if --migrate flag is set
    if [[ "$*" == *"--migrate"* ]]; then
        run_migrations
    fi

    verify_deployment

    echo_info "Deployment complete!"
}

# Run main function
main "$@"
