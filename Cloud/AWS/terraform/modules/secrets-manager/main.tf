# Secrets Manager Secret for Gmail Tokens
resource "aws_secretsmanager_secret" "gmail_tokens" {
  name        = var.gmail_tokens_secret_name
  description = "Gmail OAuth tokens for Chatterbox application"

  tags = {
    Name = "${var.environment}-${var.gmail_tokens_secret_name}"
  }
}

# Initial secret value (empty JSON object)
resource "aws_secretsmanager_secret_version" "gmail_tokens" {
  secret_id     = aws_secretsmanager_secret.gmail_tokens.id
  secret_string = jsonencode({})
}

# Secrets Manager Secret for OpenAI API Key
resource "aws_secretsmanager_secret" "openai_api_key" {
  name        = "${var.secret_prefix}/openai-api-key"
  description = "OpenAI API key for Chatterbox application"

  tags = {
    Name = "${var.environment}-openai-api-key"
  }
}

# Secrets Manager Secret for Google Credentials
resource "aws_secretsmanager_secret" "google_credentials" {
  name        = "${var.secret_prefix}/google-credentials"
  description = "Google OAuth credentials for Chatterbox application"

  tags = {
    Name = "${var.environment}-google-credentials"
  }
}

# CloudWatch Alarms for Secrets Manager
resource "aws_cloudwatch_metric_alarm" "secrets_manager_errors" {
  alarm_name          = "${var.environment}-secrets-manager-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/SecretsManager"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "Secrets Manager errors"
  alarm_actions       = var.alarm_actions
} 