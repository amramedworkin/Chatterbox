output "dynamodb_table_name" {
  description = "DynamoDB State Table Name"
  value       = aws_dynamodb_table.state_table.name
}

output "s3_bucket_name" {
  description = "S3 Email Archive Bucket Name"
  value       = aws_s3_bucket.email_archive.bucket
}

output "secrets_gmail_tokens_name" {
  description = "Secrets Manager Gmail Tokens Secret Name"
  value       = aws_secretsmanager_secret.gmail_tokens.name
}

output "secrets_google_credentials_name" {
  description = "Secrets Manager Google Credentials Secret Name"
  value       = aws_secretsmanager_secret.google_credentials.name
}

output "parameter_store_prefix" {
  description = "Parameter Store Prefix"
  value       = "/chatterbox/${var.environment}"
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch Log Group Name"
  value       = aws_cloudwatch_log_group.poll_lambda_logs.name
}

output "iam_role_arn" {
  description = "IAM Role ARN"
  value       = aws_iam_role.lambda_role.arn
}



output "environment" {
  description = "Current environment"
  value       = var.environment
}

output "resource_group_name" {
  description = "Chatterbox Resource Group Name"
  value       = aws_resourcegroups_group.chatterbox.name
}

output "resource_group_arn" {
  description = "Chatterbox Resource Group ARN"
  value       = aws_resourcegroups_group.chatterbox.arn
} 