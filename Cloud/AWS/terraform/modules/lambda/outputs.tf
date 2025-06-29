output "function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.pull_latest_chatterbox_email.function_name
}

output "function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.pull_latest_chatterbox_email.arn
}

output "invoke_arn" {
  description = "Invocation ARN of the Lambda function"
  value       = aws_lambda_function.pull_latest_chatterbox_email.invoke_arn
}

output "api_gateway_url" {
  description = "URL of the API Gateway endpoint"
  value       = "${aws_api_gateway_deployment.chatterbox_deployment.invoke_url}/pull-latest-email"
}

output "api_gateway_id" {
  description = "ID of the API Gateway REST API"
  value       = aws_api_gateway_rest_api.chatterbox_api.id
}
