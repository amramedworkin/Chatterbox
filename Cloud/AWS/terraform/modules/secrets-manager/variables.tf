variable "environment" {
  description = "Environment name"
  type        = string
}

variable "gmail_tokens_secret_name" {
  description = "Name of the Secrets Manager secret for Gmail tokens"
  type        = string
}

variable "secret_prefix" {
  description = "Prefix for secret names"
  type        = string
  default     = "chatterbox"
}

variable "alarm_actions" {
  description = "List of ARNs for CloudWatch alarm actions"
  type        = list(string)
  default     = []
} 