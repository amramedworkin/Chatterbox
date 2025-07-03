variable "environment" {
  description = "Environment name"
  type        = string
}

variable "gmail_tokens_secret_name" {
  description = "Name of the Secrets Manager secret for Gmail tokens"
  type        = string
}

variable "google_credentials_secret_name" {
  description = "Name of the Secrets Manager secret for Google credentials"
  type        = string
}

variable "email_storage_bucket" {
  description = "Name of the S3 bucket for email storage"
  type        = string
}

variable "default_gmail_user" {
  description = "Default Gmail user for the Lambda function"
  type        = string
  default     = ""
}

variable "parameter_store_prefix" {
  description = "Prefix for Parameter Store parameters"
  type        = string
  default     = "/chatterbox"
}

variable "iam_role_arn" {
  description = "ARN of the IAM role for Lambda execution"
  type        = string
}

variable "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group"
  type        = string
}
