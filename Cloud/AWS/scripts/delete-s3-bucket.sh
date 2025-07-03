#!/bin/bash

# Script to delete all contents of an S3 bucket and then delete the bucket
# Usage: ./delete-s3-bucket.sh <bucket-name> [aws-profile]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if bucket name is provided
if [ $# -eq 0 ]; then
    print_error "Usage: $0 <bucket-name> [aws-profile]"
    print_error "Example: $0 my-bucket-name cliadmin"
    exit 1
fi

BUCKET_NAME="$1"
AWS_PROFILE="${2:-cliadmin}"

print_info "Deleting S3 bucket: $BUCKET_NAME"
print_info "Using AWS profile: $AWS_PROFILE"

# Check if bucket exists
if ! aws s3 ls "s3://$BUCKET_NAME" --profile "$AWS_PROFILE" > /dev/null 2>&1; then
    print_warning "Bucket $BUCKET_NAME does not exist or is not accessible"
    exit 0
fi

print_info "Bucket exists. Starting deletion process..."

# Step 0: Check and handle versioning status
print_info "Checking bucket versioning status..."
VERSIONING_STATUS=$(aws s3api get-bucket-versioning --bucket "$BUCKET_NAME" --profile "$AWS_PROFILE" --query 'Status' --output text 2>/dev/null || echo "None")

if [ "$VERSIONING_STATUS" = "Suspended" ]; then
    print_info "Bucket versioning is suspended. Re-enabling versioning to access all versions..."
    aws s3api put-bucket-versioning --bucket "$BUCKET_NAME" --versioning-configuration Status=Enabled --profile "$AWS_PROFILE"
    print_status "Re-enabled bucket versioning"
    # Wait a moment for the change to take effect
    sleep 3
elif [ "$VERSIONING_STATUS" = "Enabled" ]; then
    print_info "Bucket versioning is enabled"
else
    print_info "Bucket versioning is not enabled"
fi

# Step 1: Delete all object versions (for versioned buckets)
print_info "Deleting all object versions..."
aws s3api list-object-versions \
    --bucket "$BUCKET_NAME" \
    --profile "$AWS_PROFILE" \
    --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' \
    --output json > /tmp/versions.json

if [ -s /tmp/versions.json ] && [ "$(jq '.Objects | length' /tmp/versions.json)" -gt 0 ]; then
    print_info "Found $(jq '.Objects | length' /tmp/versions.json) object versions to delete"
    aws s3api delete-objects \
        --bucket "$BUCKET_NAME" \
        --delete file:///tmp/versions.json \
        --profile "$AWS_PROFILE"
    print_status "Deleted all object versions"
else
    print_info "No object versions found"
fi

# Step 2: Delete all delete markers (for versioned buckets)
print_info "Deleting all delete markers..."
aws s3api list-object-versions \
    --bucket "$BUCKET_NAME" \
    --profile "$AWS_PROFILE" \
    --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' \
    --output json > /tmp/markers.json

if [ -s /tmp/markers.json ] && [ "$(jq '.Objects | length' /tmp/markers.json)" -gt 0 ]; then
    print_info "Found $(jq '.Objects | length' /tmp/markers.json) delete markers to delete"
    aws s3api delete-objects \
        --bucket "$BUCKET_NAME" \
        --delete file:///tmp/markers.json \
        --profile "$AWS_PROFILE"
    print_status "Deleted all delete markers"
else
    print_info "No delete markers found"
fi

# Step 3: Delete all objects (current versions)
print_info "Deleting all current objects..."
aws s3api list-objects-v2 \
    --bucket "$BUCKET_NAME" \
    --profile "$AWS_PROFILE" \
    --query '{Objects: Contents[].{Key:Key}}' \
    --output json > /tmp/objects.json

if [ -s /tmp/objects.json ] && [ "$(jq '.Objects | length' /tmp/objects.json)" -gt 0 ]; then
    print_info "Found $(jq '.Objects | length' /tmp/objects.json) objects to delete"
    aws s3api delete-objects \
        --bucket "$BUCKET_NAME" \
        --delete file:///tmp/objects.json \
        --profile "$AWS_PROFILE"
    print_status "Deleted all objects"
else
    print_info "No objects found"
fi

# Step 4: Delete all multipart uploads
print_info "Deleting all multipart uploads..."
aws s3api list-multipart-uploads \
    --bucket "$BUCKET_NAME" \
    --profile "$AWS_PROFILE" \
    --query 'Uploads[].{Key:Key,UploadId:UploadId}' \
    --output json > /tmp/uploads.json

if [ -s /tmp/uploads.json ] && [ "$(jq '. | length' /tmp/uploads.json)" -gt 0 ]; then
    print_info "Found $(jq '. | length' /tmp/uploads.json) multipart uploads to delete"
    jq -c '.[]' /tmp/uploads.json | while read -r upload; do
        KEY=$(echo "$upload" | jq -r '.Key')
        UPLOAD_ID=$(echo "$upload" | jq -r '.UploadId')
        aws s3api abort-multipart-upload \
            --bucket "$BUCKET_NAME" \
            --key "$KEY" \
            --upload-id "$UPLOAD_ID" \
            --profile "$AWS_PROFILE"
    done
    print_status "Deleted all multipart uploads"
else
    print_info "No multipart uploads found"
fi

# Step 5: Delete the bucket
print_info "Deleting the bucket..."
aws s3 rb "s3://$BUCKET_NAME" --profile "$AWS_PROFILE"
print_status "Successfully deleted bucket: $BUCKET_NAME"

# Clean up temporary files
rm -f /tmp/versions.json /tmp/markers.json /tmp/objects.json /tmp/uploads.json

print_status "S3 bucket deletion completed successfully!" 