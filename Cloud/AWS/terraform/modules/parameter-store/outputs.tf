output "prefix" {
  description = "Parameter Store prefix"
  value       = var.prefix
}

output "app_config_parameter_name" {
  description = "App config parameter name"
  value       = aws_ssm_parameter.app_config.name
}

output "polling_config_parameter_name" {
  description = "Polling config parameter name"
  value       = aws_ssm_parameter.polling_config.name
}

output "openai_config_parameter_name" {
  description = "OpenAI config parameter name"
  value       = aws_ssm_parameter.openai_config.name
}

output "google_config_parameter_name" {
  description = "Google config parameter name"
  value       = aws_ssm_parameter.google_config.name
}

output "parameter_arn" {
  description = "Parameter Store ARN pattern"
  value       = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${var.prefix}/*"
} 