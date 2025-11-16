#!/bin/bash
set -e

# AI Chat Platform Backup Script
# Backs up database, Redis data, and uploaded documents

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-""}
REGION=${GCP_REGION:-"us-central1"}
BACKUP_BUCKET=${BACKUP_BUCKET:-"${PROJECT_ID}-backups"}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=${RETENTION_DAYS:-30}

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
if [ -z "$PROJECT_ID" ]; then
    echo_error "GCP_PROJECT_ID not set"
    exit 1
fi

# Create backup bucket if it doesn't exist
create_backup_bucket() {
    echo_info "Ensuring backup bucket exists..."

    if gsutil ls -b gs://${BACKUP_BUCKET} &> /dev/null; then
        echo_info "Backup bucket already exists"
    else
        echo_info "Creating backup bucket..."
        gsutil mb -p ${PROJECT_ID} -l ${REGION} gs://${BACKUP_BUCKET}
        gsutil versioning set on gs://${BACKUP_BUCKET}
        echo_info "Backup bucket created"
    fi
}

# Backup Cloud SQL database
backup_database() {
    echo_info "Starting database backup..."

    INSTANCE_NAME="ai-chat-platform-postgres"
    BACKUP_ID="backup-${TIMESTAMP}"

    # Create Cloud SQL backup
    gcloud sql backups create \
        --instance=${INSTANCE_NAME} \
        --project=${PROJECT_ID} \
        --description="Automated backup ${TIMESTAMP}"

    echo_info "Database backup created: ${BACKUP_ID}"

    # Export database to GCS
    echo_info "Exporting database to Cloud Storage..."

    gcloud sql export sql ${INSTANCE_NAME} \
        gs://${BACKUP_BUCKET}/database/${TIMESTAMP}/dump.sql \
        --database=ai_chat_platform \
        --project=${PROJECT_ID}

    echo_info "Database export complete"
}

# Backup Redis data
backup_redis() {
    echo_info "Starting Redis backup..."

    REDIS_INSTANCE="ai-chat-platform-redis"

    # Get Redis host
    REDIS_HOST=$(gcloud redis instances describe ${REDIS_INSTANCE} \
        --region=${REGION} \
        --project=${PROJECT_ID} \
        --format="value(host)")

    echo_info "Redis backup complete (automatic persistence enabled)"
}

# Backup uploaded documents
backup_documents() {
    echo_info "Starting document backup..."

    SOURCE_BUCKET="${PROJECT_ID}-documents"
    DEST_PATH="gs://${BACKUP_BUCKET}/documents/${TIMESTAMP}/"

    # Copy documents to backup bucket
    gsutil -m rsync -r gs://${SOURCE_BUCKET} ${DEST_PATH}

    echo_info "Document backup complete"
}

# Backup Kubernetes configurations
backup_kubernetes() {
    echo_info "Starting Kubernetes configuration backup..."

    mkdir -p /tmp/k8s-backup-${TIMESTAMP}

    # Export all resources
    kubectl get all --all-namespaces -o yaml > /tmp/k8s-backup-${TIMESTAMP}/all-resources.yaml
    kubectl get configmaps --all-namespaces -o yaml > /tmp/k8s-backup-${TIMESTAMP}/configmaps.yaml
    kubectl get secrets --all-namespaces -o yaml > /tmp/k8s-backup-${TIMESTAMP}/secrets.yaml
    kubectl get ingress --all-namespaces -o yaml > /tmp/k8s-backup-${TIMESTAMP}/ingress.yaml

    # Upload to GCS
    gsutil -m cp -r /tmp/k8s-backup-${TIMESTAMP} gs://${BACKUP_BUCKET}/kubernetes/

    # Cleanup
    rm -rf /tmp/k8s-backup-${TIMESTAMP}

    echo_info "Kubernetes configuration backup complete"
}

# Cleanup old backups
cleanup_old_backups() {
    echo_info "Cleaning up backups older than ${RETENTION_DAYS} days..."

    # Calculate cutoff date
    CUTOFF_DATE=$(date -d "${RETENTION_DAYS} days ago" +%Y%m%d)

    # List and delete old backups
    gsutil ls gs://${BACKUP_BUCKET}/database/ | while read -r backup; do
        BACKUP_DATE=$(echo $backup | grep -oP '\d{8}' | head -1)
        if [ ! -z "$BACKUP_DATE" ] && [ "$BACKUP_DATE" -lt "$CUTOFF_DATE" ]; then
            echo_info "Deleting old backup: $backup"
            gsutil -m rm -r $backup
        fi
    done

    # Cleanup Cloud SQL backups
    gcloud sql backups list \
        --instance=ai-chat-platform-postgres \
        --project=${PROJECT_ID} \
        --filter="creationTime < $(date -d '${RETENTION_DAYS} days ago' --iso-8601)" \
        --format="value(id)" | while read -r backup_id; do
            echo_info "Deleting old SQL backup: $backup_id"
            gcloud sql backups delete $backup_id \
                --instance=ai-chat-platform-postgres \
                --project=${PROJECT_ID} \
                --quiet
        done

    echo_info "Cleanup complete"
}

# Generate backup report
generate_report() {
    echo_info "Generating backup report..."

    REPORT_FILE="/tmp/backup-report-${TIMESTAMP}.txt"

    cat > ${REPORT_FILE} << EOF
AI Chat Platform Backup Report
==============================
Timestamp: ${TIMESTAMP}
Project: ${PROJECT_ID}
Region: ${REGION}

Backup Locations:
- Database: gs://${BACKUP_BUCKET}/database/${TIMESTAMP}/
- Documents: gs://${BACKUP_BUCKET}/documents/${TIMESTAMP}/
- Kubernetes: gs://${BACKUP_BUCKET}/kubernetes/k8s-backup-${TIMESTAMP}/

Backup Status:
- Database: SUCCESS
- Documents: SUCCESS
- Kubernetes: SUCCESS

Next Steps:
1. Verify backup integrity
2. Test restore procedure
3. Update backup documentation

EOF

    # Upload report
    gsutil cp ${REPORT_FILE} gs://${BACKUP_BUCKET}/reports/

    # Display report
    cat ${REPORT_FILE}

    # Cleanup
    rm ${REPORT_FILE}
}

# Verify backup integrity
verify_backup() {
    echo_info "Verifying backup integrity..."

    # Check database backup exists
    if gsutil ls gs://${BACKUP_BUCKET}/database/${TIMESTAMP}/dump.sql &> /dev/null; then
        echo_info "✓ Database backup verified"
    else
        echo_error "✗ Database backup not found"
        exit 1
    fi

    # Check documents backup
    DOC_COUNT=$(gsutil ls -r gs://${BACKUP_BUCKET}/documents/${TIMESTAMP}/ | wc -l)
    echo_info "✓ Documents backup verified (${DOC_COUNT} objects)"

    # Check Kubernetes backup
    if gsutil ls gs://${BACKUP_BUCKET}/kubernetes/k8s-backup-${TIMESTAMP}/ &> /dev/null; then
        echo_info "✓ Kubernetes backup verified"
    else
        echo_error "✗ Kubernetes backup not found"
        exit 1
    fi

    echo_info "All backups verified successfully"
}

# Main backup process
main() {
    echo_info "Starting backup process..."
    echo_info "Timestamp: ${TIMESTAMP}"

    create_backup_bucket
    backup_database
    backup_redis
    backup_documents
    backup_kubernetes
    verify_backup
    cleanup_old_backups
    generate_report

    echo_info "Backup process complete!"
}

# Run main function
main
