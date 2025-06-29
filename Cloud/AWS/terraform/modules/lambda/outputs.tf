output "function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.email_reader.arn
}

output "function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.email_reader.function_name
}

output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = aws_apigatewayv2_stage.email_api_stage.invoke_url
}

output "api_gateway_id" {
  description = "ID of the API Gateway"
  value       = aws_apigatewayv2_api.email_api.id
}

output "lambda_role_arn" {
  description = "ARN of the Lambda IAM role"
  value       = aws_iam_role.lambda_role.arn
} 