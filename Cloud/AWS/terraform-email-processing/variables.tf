# Cloud/AWS/terraform-email-processing/variables.tf
# Variables for AWS-native email processing infrastructure

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (development, staging, prod)"
  type        = string
  default     = "development"
  
  validation {
    condition     = contains(["development", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: development, staging, prod."
  }
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "chatterbox"
}

variable "service_name" {
  description = "Service name"
  type        = string
  default     = "email-processing"
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 300
}

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 512
}

variable "response_generator_memory_size" {
  description = "Response generator Lambda memory size in MB"
  type        = number
  default     = 1024
}

variable "sqs_visibility_timeout" {
  description = "SQS visibility timeout in seconds"
  type        = number
  default     = 300
}

variable "sqs_message_retention" {
  description = "SQS message retention period in seconds"
  type        = number
  default     = 345600 # 4 days
}

variable "attachment_retention_days" {
  description = "Number of days to retain attachments in S3"
  type        = number
  default     = 30
}

variable "email_content_retention_days" {
  description = "Number of days to retain email content in S3"
  type        = number
  default     = 7
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 14
}

variable "default_llm_model" {
  description = "Default LLM model to use"
  type        = string
  default     = "gpt-4o"
}

variable "free_tier_limit" {
  description = "Number of free queries allowed per user"
  type        = number
  default     = 10
}

variable "infrastructure_cost" {
  description = "Infrastructure cost per query in USD"
  type        = number
  default     = 0.01
}

variable "licensing_cost" {
  description = "Licensing cost per query in USD"
  type        = number
  default     = 0.005
}

variable "rejection_rate_limit_seconds" {
  description = "Rate limit for rejection notifications in seconds"
  type        = number
  default     = 300
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project     = "chatterbox"
    Service     = "email-processing"
    ManagedBy   = "terraform"
  }
} 