variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment (local, development, staging, production)"
  type        = string
  default     = "development"

  validation {
    condition     = contains(["local", "development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: local, development, staging, production."
  }
}

variable "dynamodb_state_table_name" {
  description = "Name of DynamoDB table for state storage"
  type        = string
  default     = "chatterbox-state-table"
}

variable "s3_bucket_name" {
  description = "Name of S3 bucket for data storage"
  type        = string
  default     = "chatterbox-data-bucket"
}

variable "s3_backup_bucket_name" {
  description = "Name of S3 bucket for backups"
  type        = string
  default     = "chatterbox-backup-bucket"
}

variable "s3_email_archive_bucket_name" {
  description = "Name of S3 bucket for email archive storage"
  type        = string
  default     = "chatterbox-email-archive"
}

variable "secrets_gmail_tokens_name" {
  description = "Name of Secrets Manager secret for Gmail tokens"
  type        = string
  default     = "chatterbox-gmail-tokens"
}

variable "parameter_store_prefix" {
  description = "Prefix for Parameter Store parameters"
  type        = string
  default     = "/chatterbox"
}

variable "cloudwatch_log_group_name" {
  description = "Name of CloudWatch log group"
  type        = string
  default     = "/aws/chatterbox"
}

variable "enable_encryption" {
  description = "Enable encryption for all resources"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 90
}

variable "enable_debug_logging" {
  description = "Enable debug logging for the environment"
  type        = bool
  default     = false
}

variable "enable_cost_alerts" {
  description = "Enable cost monitoring alerts"
  type        = bool
  default     = false
} 