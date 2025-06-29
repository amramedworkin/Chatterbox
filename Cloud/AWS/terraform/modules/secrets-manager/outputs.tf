output "gmail_tokens_secret_name" {
  description = "Secrets Manager Gmail tokens secret name"
  value       = aws_secretsmanager_secret.gmail_tokens.name
}

output "gmail_tokens_secret_arn" {
  description = "Secrets Manager Gmail tokens secret ARN"
  value       = aws_secretsmanager_secret.gmail_tokens.arn
}

output "openai_api_key_secret_name" {
  description = "Secrets Manager OpenAI API key secret name"
  value       = aws_secretsmanager_secret.openai_api_key.name
}

output "openai_api_key_secret_arn" {
  description = "Secrets Manager OpenAI API key secret ARN"
  value       = aws_secretsmanager_secret.openai_api_key.arn
}

output "google_credentials_secret_name" {
  description = "Secrets Manager Google credentials secret name"
  value       = aws_secretsmanager_secret.google_credentials.name
}

output "google_credentials_secret_arn" {
  description = "Secrets Manager Google credentials secret ARN"
  value       = aws_secretsmanager_secret.google_credentials.arn
}

output "secret_arns" {
  description = "List of all Secrets Manager ARNs"
  value = [
    aws_secretsmanager_secret.gmail_tokens.arn,
    aws_secretsmanager_secret.openai_api_key.arn,
    aws_secretsmanager_secret.google_credentials.arn
  ]
} 