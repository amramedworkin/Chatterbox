variable "environment" {
  description = "Environment name (e.g., development, staging, production)"
  type        = string
}

variable "secrets_arns" {
  description = "ARNs of Secrets Manager secrets for Gmail tokens"
  type        = list(string)
} 