#!/bin/zsh

# Standalone script to forcefully remove Chatterbox IAM resources

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PROFILE="cliadmin"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}
log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}
log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}
log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}
log_header() {
    echo -e "${PURPLE}=== $1 ===${NC}"
}

log_header "Forcefully Removing Chatterbox IAM Resources (Standalone)"

user="chatteradmin"
group="chatteradmingrp"
role="development-chatterbox-role"

# Remove all access keys for user
log_info "Checking for access keys for user $user..."
access_keys=$(aws iam list-access-keys --user-name "$user" --profile "$PROFILE" --query 'AccessKeyMetadata[].AccessKeyId' --output text 2>/dev/null || echo "")
for key in $access_keys; do
    log_info "Deleting access key $key for user $user..."
    aws iam delete-access-key --user-name "$user" --access-key-id "$key" --profile "$PROFILE" 2>/dev/null && \
        log_success "Access key $key deleted" || log_warning "Failed to delete access key $key or it does not exist"
done

# Remove user from all groups
log_info "Checking for groups for user $user..."
groups=$(aws iam list-groups-for-user --user-name "$user" --profile "$PROFILE" --query 'Groups[].GroupName' --output text 2>/dev/null || echo "")
for g in $groups; do
    log_info "Removing user $user from group $g..."
    aws iam remove-user-from-group --user-name "$user" --group-name "$g" --profile "$PROFILE" 2>/dev/null && \
        log_success "User $user removed from group $g" || log_warning "Failed to remove user $user from group $g or not a member"
done

# Detach all policies from user
log_info "Detaching all policies from user $user..."
user_policies=$(aws iam list-attached-user-policies --user-name "$user" --profile "$PROFILE" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null || echo "")
for policy_arn in $user_policies; do
    log_info "Detaching policy $policy_arn from user $user..."
    aws iam detach-user-policy --user-name "$user" --policy-arn "$policy_arn" --profile "$PROFILE" 2>/dev/null && \
        log_success "Policy $policy_arn detached from user $user" || log_warning "Failed to detach policy $policy_arn from user $user"
done

# Delete user
log_info "Deleting user $user..."
aws iam delete-user --user-name "$user" --profile "$PROFILE" 2>/dev/null && \
    log_success "User $user deleted" || log_warning "User $user not found or could not be deleted"

# Delete group
log_info "Deleting group $group..."
aws iam delete-group --group-name "$group" --profile "$PROFILE" 2>/dev/null && \
    log_success "Group $group deleted" || log_warning "Group $group not found or could not be deleted"

# Detach all policies from role
log_info "Detaching all policies from role $role..."
role_policies=$(aws iam list-attached-role-policies --role-name "$role" --profile "$PROFILE" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null || echo "")
for policy_arn in $role_policies; do
    log_info "Detaching policy $policy_arn from role $role..."
    aws iam detach-role-policy --role-name "$role" --policy-arn "$policy_arn" --profile "$PROFILE" 2>/dev/null && \
        log_success "Policy $policy_arn detached from role $role" || log_warning "Failed to detach policy $policy_arn from role $role"
done

# Delete all inline policies from role
log_info "Deleting all inline policies from role $role..."
inline_policies=$(aws iam list-role-policies --role-name "$role" --profile "$PROFILE" --query 'PolicyNames[]' --output text 2>/dev/null || echo "")
for policy_name in $inline_policies; do
    log_info "Deleting inline policy $policy_name from role $role..."
    aws iam delete-role-policy --role-name "$role" --policy-name "$policy_name" --profile "$PROFILE" 2>/dev/null && \
        log_success "Inline policy $policy_name deleted from role $role" || log_warning "Failed to delete inline policy $policy_name from role $role"
done

# Remove role from any instance profiles
log_info "Checking for instance profiles for role $role..."
instance_profiles=$(aws iam list-instance-profiles-for-role --role-name "$role" --profile "$PROFILE" --query 'InstanceProfiles[].InstanceProfileName' --output text 2>/dev/null || echo "")
for profile in $instance_profiles; do
    log_info "Removing role $role from instance profile $profile..."
    aws iam remove-role-from-instance-profile --instance-profile-name "$profile" --role-name "$role" --profile "$PROFILE" 2>/dev/null && \
        log_success "Role $role removed from instance profile $profile" || log_warning "Failed to remove role $role from instance profile $profile"
done

# Delete role
log_info "Deleting role $role..."
aws iam delete-role --role-name "$role" --profile "$PROFILE" 2>/dev/null && \
    log_success "Role $role deleted" || log_warning "Role $role not found or could not be deleted" 