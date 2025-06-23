# Environment-specific configurations for Chatterbox AWS infrastructure

# Development Environment
development = {
  environment = "development"
  vpc_cidr_block = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b"]
  dynamodb_state_table_name = "chatterbox-dev-state"
  s3_bucket_name = "chatterbox-dev-data"
  s3_backup_bucket_name = "chatterbox-dev-backups"
  secrets_gmail_tokens_name = "chatterbox-dev/gmail-tokens"
  parameter_store_prefix = "/chatterbox/dev"
  cloudwatch_log_group_name = "/aws/chatterbox/dev"
  enable_vpc_endpoints = true
  enable_encryption = true
  backup_retention_days = 30
  log_retention_days = 90
}

# Staging Environment
staging = {
  environment = "staging"
  vpc_cidr_block = "10.1.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  dynamodb_state_table_name = "chatterbox-staging-state"
  s3_bucket_name = "chatterbox-staging-data"
  s3_backup_bucket_name = "chatterbox-staging-backups"
  secrets_gmail_tokens_name = "chatterbox-staging/gmail-tokens"
  parameter_store_prefix = "/chatterbox/staging"
  cloudwatch_log_group_name = "/aws/chatterbox/staging"
  enable_vpc_endpoints = true
  enable_encryption = true
  backup_retention_days = 60
  log_retention_days = 180
}

# Production Environment
production = {
  environment = "production"
  vpc_cidr_block = "10.2.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  dynamodb_state_table_name = "chatterbox-prod-state"
  s3_bucket_name = "chatterbox-prod-data"
  s3_backup_bucket_name = "chatterbox-prod-backups"
  secrets_gmail_tokens_name = "chatterbox-prod/gmail-tokens"
  parameter_store_prefix = "/chatterbox/prod"
  cloudwatch_log_group_name = "/aws/chatterbox/prod"
  enable_vpc_endpoints = true
  enable_encryption = true
  backup_retention_days = 365
  log_retention_days = 365
} 