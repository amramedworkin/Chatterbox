variable "environment" {
  description = "Environment name"
  type        = string
}

variable "state_table_name" {
  description = "Name of the DynamoDB table for state storage"
  type        = string
}

variable "enable_autoscaling" {
  description = "Enable auto scaling for DynamoDB table"
  type        = bool
  default     = false
}

variable "alarm_actions" {
  description = "List of ARNs for CloudWatch alarm actions"
  type        = list(string)
  default     = []
} 