variable "environment" {
  description = "Environment name (e.g., development, staging, production)"
  type        = string
}

variable "aws_region" {
  description = "AWS region for SES"
  type        = string
  default     = "us-east-1"
}

variable "enable_sending" {
  description = "Whether to enable SES account sending"
  type        = bool
  default     = true
}

variable "email_addresses" {
  description = "List of email addresses to verify in SES"
  type        = list(string)
  default     = []
}

variable "create_configuration_set" {
  description = "Whether to create a SES configuration set"
  type        = bool
  default     = false
}

variable "create_cloudwatch_alarms" {
  description = "Whether to create CloudWatch alarms for SES"
  type        = bool
  default     = false
}

variable "create_iam_policy" {
  description = "Whether to create IAM policy for SES access"
  type        = bool
  default     = false
} 