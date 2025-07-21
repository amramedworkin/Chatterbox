variable "environment" {
  description = "Environment name (e.g., development, staging, production)"
  type        = string
}

variable "gmail_tokens_secret_name" {
  description = "Name of the Gmail tokens secret in Secrets Manager"
  type        = string
}

variable "openai_api_key_secret_name" {
  description = "Name of the OpenAI API key secret in Secrets Manager"
  type        = string
}

variable "parameter_store_prefix" {
  description = "Prefix for SSM Parameter Store parameters"
  type        = string
}

variable "secrets_arns" {
  description = "List of secret ARNs that Lambda functions can access"
  type        = list(string)
}

variable "parameter_store_arn" {
  description = "ARN of the Parameter Store that Lambda functions can access"
  type        = string
} 