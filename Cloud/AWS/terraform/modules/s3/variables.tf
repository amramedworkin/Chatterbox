variable "environment" {
  description = "Environment name"
  type        = string
}

variable "bucket_name" {
  description = "Name of the S3 bucket for data storage"
  type        = string
}

variable "backup_bucket_name" {
  description = "Name of the S3 bucket for backups"
  type        = string
}

variable "iam_role_arn" {
  description = "ARN of the IAM role for Chatterbox application"
  type        = string
} 