output "ses_account_sending_enabled" {
  description = "Whether SES account sending is enabled"
  value       = aws_ses_account_sending_enabled.main.enabled
}

output "verified_email_addresses" {
  description = "List of verified email addresses"
  value       = [for email in aws_ses_email_identity.emails : email.email]
}

output "configuration_set_name" {
  description = "Name of the SES configuration set"
  value       = var.create_configuration_set ? aws_ses_configuration_set.main[0].name : null
}

output "ses_policy_arn" {
  description = "ARN of the SES IAM policy"
  value       = var.create_iam_policy ? aws_iam_policy.ses_policy[0].arn : null
} 