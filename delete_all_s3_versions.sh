#!/bin/bash
BUCKET="development-chatterbox-email-archive"
PROFILE="cliadmin"

if [ ! -f s3_versions.json ]; then
  echo "s3_versions.json not found!"
  exit 1
fi

# Delete all versions
jq -c '.Versions[]' s3_versions.json | while read -r version; do
  KEY=$(echo "$version" | jq -r '.Key')
  VERSION_ID=$(echo "$version" | jq -r '.VersionId')
  echo "Deleting version: $KEY ($VERSION_ID)"
  aws s3api delete-object --bucket "$BUCKET" --key "$KEY" --version-id "$VERSION_ID" --profile "$PROFILE"
done

# Delete all delete markers
jq -c '.DeleteMarkers[]' s3_versions.json | while read -r marker; do
  KEY=$(echo "$marker" | jq -r '.Key')
  VERSION_ID=$(echo "$marker" | jq -r '.VersionId')
  echo "Deleting delete marker: $KEY ($VERSION_ID)"
  aws s3api delete-object --bucket "$BUCKET" --key "$KEY" --version-id "$VERSION_ID" --profile "$PROFILE"
done

echo "All versions and delete markers deleted." 