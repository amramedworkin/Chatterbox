# SES (Simple Email Service) Module
# This module sets up SES for email sending

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# SES Account Configuration
resource "aws_ses_account_sending_enabled" "main" {
  enabled = var.enable_sending
}

# SES Email Identities (for verification)
resource "aws_ses_email_identity" "emails" {
  for_each = toset(var.email_addresses)
  email    = each.value
}

# SES Configuration Set (optional)
resource "aws_ses_configuration_set" "main" {
  count = var.create_configuration_set ? 1 : 0
  
  name = "${var.environment}-chatterbox-ses-config"
  
  delivery_options {
    tls_policy = "Optional"
  }
  
  reputation_metrics_enabled = true
  last_fresh_start_enabled   = true
}

# CloudWatch Alarms for SES
resource "aws_cloudwatch_metric_alarm" "ses_bounce_rate" {
  count = var.create_cloudwatch_alarms ? 1 : 0
  
  alarm_name          = "${var.environment}-chatterbox-ses-bounce-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "BounceRate"
  namespace           = "AWS/SES"
  period              = "300"
  statistic           = "Average"
  threshold           = "5.0"
  alarm_description   = "SES bounce rate is too high"
  
  dimensions = {
    Region = var.aws_region
  }
}

resource "aws_cloudwatch_metric_alarm" "ses_complaint_rate" {
  count = var.create_cloudwatch_alarms ? 1 : 0
  
  alarm_name          = "${var.environment}-chatterbox-ses-complaint-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ComplaintRate"
  namespace           = "AWS/SES"
  period              = "300"
  statistic           = "Average"
  threshold           = "0.1"
  alarm_description   = "SES complaint rate is too high"
  
  dimensions = {
    Region = var.aws_region
  }
}

# IAM Policy for SES access
resource "aws_iam_policy" "ses_policy" {
  count = var.create_iam_policy ? 1 : 0
  
  name        = "${var.environment}-chatterbox-ses-policy"
  description = "Policy for SES email sending"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:GetSendQuota",
          "ses:GetSendStatistics",
          "ses:ListIdentities",
          "ses:GetIdentityVerificationAttributes"
        ]
        Resource = "*"
      }
    ]
  })
} 