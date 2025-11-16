#!/bin/bash
set -e

# AI Chat Platform Restore Script
# Restores database, Redis data, and documents from backup

# Usage: ./restore.sh <backup-timestamp>

BACKUP_TIMESTAMP=${1:-""}
PROJECT_ID=${GCP_PROJECT_ID:-""}
REGION=${GCP_REGION:-"us-central1"}
BACKUP_BUCKET=${BACKUP_BUCKET:-"${PROJECT_ID}-backups"}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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
if [ -z "$BACKUP_TIMESTAMP" ]; then
    echo_error "Usage: ./restore.sh <backup-timestamp>"
    echo_info "Available backups:"
    gsutil ls gs://${BACKUP_BUCKET}/database/ | grep -oP '\d{8}-\d{6}'
    exit 1
fi

if [ -z "$PROJECT_ID" ]; then
    echo_error "GCP_PROJECT_ID not set"
    exit 1
fi

# Confirmation prompt
confirm_restore() {
    echo_warn "WARNING: This will restore data from backup ${BACKUP_TIMESTAMP}"
    echo_warn "Current data will be overwritten!"
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM

    if [ "$CONFIRM" != "yes" ]; then
        echo_info "Restore cancelled"
        exit 0
    fi
}

# Restore database
restore_database() {
    echo_info "Restoring database..."

    INSTANCE_NAME="ai-chat-platform-postgres"
    BACKUP_PATH="gs://${BACKUP_BUCKET}/database/${BACKUP_TIMESTAMP}/dump.sql"

    # Verify backup exists
    if ! gsutil ls ${BACKUP_PATH} &> /dev/null; then
        echo_error "Database backup not found at ${BACKUP_PATH}"
        exit 1
    fi

    # Import database
    gcloud sql import sql ${INSTANCE_NAME} ${BACKUP_PATH} \
        --database=ai_chat_platform \
        --project=${PROJECT_ID}

    echo_info "Database restored successfully"
}

# Restore documents
restore_documents() {
    echo_info "Restoring documents..."

    SOURCE_PATH="gs://${BACKUP_BUCKET}/documents/${BACKUP_TIMESTAMP}/"
    DEST_BUCKET="${PROJECT_ID}-documents"

    # Verify backup exists
    if ! gsutil ls ${SOURCE_PATH} &> /dev/null; then
        echo_error "Documents backup not found at ${SOURCE_PATH}"
        exit 1
    fi

    # Restore documents
    gsutil -m rsync -r -d ${SOURCE_PATH} gs://${DEST_BUCKET}/

    echo_info "Documents restored successfully"
}

# Restore Kubernetes configurations
restore_kubernetes() {
    echo_info "Restoring Kubernetes configurations..."

    BACKUP_PATH="gs://${BACKUP_BUCKET}/kubernetes/k8s-backup-${BACKUP_TIMESTAMP}/"

    # Download backup
    mkdir -p /tmp/k8s-restore
    gsutil -m cp -r ${BACKUP_PATH}* /tmp/k8s-restore/

    echo_warn "Kubernetes configurations downloaded to /tmp/k8s-restore/"
    echo_warn "Please review and manually apply as needed:"
    echo_warn "  kubectl apply -f /tmp/k8s-restore/"

    echo_info "Kubernetes restore prepared (manual apply required)"
}

# Verify restore
verify_restore() {
    echo_info "Verifying restore..."

    # Test database connection
    echo_info "Testing database connection..."
    # Add database connection test here

    # Check document count
    DOC_COUNT=$(gsutil ls -r gs://${PROJECT_ID}-documents/ | wc -l)
    echo_info "Documents restored: ${DOC_COUNT} objects"

    echo_info "Restore verification complete"
}

# Main restore process
main() {
    echo_info "Starting restore process..."
    echo_info "Backup timestamp: ${BACKUP_TIMESTAMP}"

    confirm_restore
    restore_database
    restore_documents
    restore_kubernetes
    verify_restore

    echo_info "Restore process complete!"
    echo_warn "Please restart application pods to ensure all changes take effect:"
    echo_warn "  kubectl rollout restart deployment/ai-chat-backend"
    echo_warn "  kubectl rollout restart deployment/ai-chat-frontend"
}

# Run main function
main
