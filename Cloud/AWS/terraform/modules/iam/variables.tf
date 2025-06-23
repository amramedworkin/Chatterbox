variable "environment" {
  description = "Environment name"
  type        = string
}

variable "dynamodb_table_arn" {
  description = "DynamoDB table ARN"
  type        = string
  default     = ""
}

variable "s3_bucket_arn" {
  description = "S3 bucket ARN"
  type        = string
  default     = ""
}

variable "s3_backup_bucket_arn" {
  description = "S3 backup bucket ARN"
  type        = string
  default     = ""
}

variable "secrets_arns" {
  description = "List of Secrets Manager ARNs"
  type        = list(string)
  default     = []
}

variable "parameter_store_arn" {
  description = "Parameter Store ARN"
  type        = string
  default     = ""
}

variable "cloudwatch_log_group_arn" {
  description = "CloudWatch log group ARN"
  type        = string
  default     = ""
} 