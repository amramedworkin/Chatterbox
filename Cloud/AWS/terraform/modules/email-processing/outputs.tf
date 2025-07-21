output "email_queries_table_name" {
  description = "Name of the email queries DynamoDB table"
  value       = aws_dynamodb_table.email_queries.name
}

output "conversations_table_name" {
  description = "Name of the conversations DynamoDB table"
  value       = aws_dynamodb_table.conversations.name
}

output "generated_responses_table_name" {
  description = "Name of the generated responses DynamoDB table"
  value       = aws_dynamodb_table.generated_responses.name
}

output "query_records_table_name" {
  description = "Name of the query records DynamoDB table"
  value       = aws_dynamodb_table.query_records.name
}

output "user_profiles_table_name" {
  description = "Name of the user profiles DynamoDB table"
  value       = aws_dynamodb_table.user_profiles.name
}

output "response_generation_queue_url" {
  description = "URL of the response generation SQS queue"
  value       = aws_sqs_queue.response_generation.url
}

output "response_generation_dlq_url" {
  description = "URL of the response generation dead letter queue"
  value       = aws_sqs_queue.response_generation_dlq.url
}

output "email_processor_function_name" {
  description = "Name of the email processor Lambda function"
  value       = aws_lambda_function.email_processor.function_name
}

output "email_processor_function_arn" {
  description = "ARN of the email processor Lambda function"
  value       = aws_lambda_function.email_processor.arn
}

output "response_generator_function_name" {
  description = "Name of the response generator Lambda function"
  value       = aws_lambda_function.response_generator.function_name
}

output "response_generator_function_arn" {
  description = "ARN of the response generator Lambda function"
  value       = aws_lambda_function.response_generator.arn
}

output "email_processor_role_arn" {
  description = "ARN of the email processor Lambda IAM role"
  value       = aws_iam_role.email_processor_lambda.arn
}

output "response_generator_role_arn" {
  description = "ARN of the response generator Lambda IAM role"
  value       = aws_iam_role.response_generator_lambda.arn
} 